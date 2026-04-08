from __future__ import annotations

import subprocess
import sys
import time
from datetime import timedelta
from pathlib import Path
from uuid import UUID, uuid4

from backend.app.db import get_db_connection
from backend.app.modules.sync.repository import SyncRepository
from backend.app.modules.sync.retry import get_retry_decision

ROOT = Path(__file__).resolve().parents[4]
REFRESH_MARTS = ROOT / 'scripts' / 'refresh_marts.py'
REFRESH_STOCK_MARTS = ROOT / 'scripts' / 'refresh_stock_marts.py'
STEP_THROTTLE_SECONDS = 5
FUNNEL_STEP_THROTTLE_SECONDS = 20

class SyncExecutor:
    def __init__(self, *, root: Path | None = None, python_executable: str | None = None) -> None:
        self._root = root or ROOT
        self._python_executable = python_executable or sys.executable

    def execute_job_until_done(
        self,
        *,
        job_id: UUID,
        mode: str | None = None,
        dataset: str | None = None,
        max_steps: int | None = None,
    ) -> int:
        with get_db_connection() as lock_conn:
            lock_repository = SyncRepository(lock_conn)
            job_row = lock_repository.get_job(job_id)
            if job_row is None:
                print(f'job_id={job_id} status=skipped reason=job_not_found')
                return 0

            resolved_mode = mode or str(job_row['mode'])
            resolved_dataset = dataset
            account_id = UUID(str(job_row['account_id']))

            job_lock_acquired = lock_repository.try_acquire_job_execution_lock(job_id)
            if not job_lock_acquired:
                print(f'job_id={job_id} status=skipped reason=execution_lock_held')
                return 0

            account_lock_acquired = lock_repository.try_acquire_account_execution_lock(
                account_id,
                mode=resolved_mode,
                dataset=resolved_dataset,
            )
            if not account_lock_acquired:
                lock_repository.release_job_execution_lock(job_id)
                lock_conn.commit()
                print(
                    f'job_id={job_id} account_id={account_id} status=skipped reason=account_execution_lock_held',
                )
                return 0

            try:
                return self._execute_job_until_done_unlocked(
                    job_id=job_id,
                    mode=resolved_mode,
                    dataset=resolved_dataset,
                    max_steps=max_steps,
                )
            finally:
                lock_repository.release_account_execution_lock(
                    account_id,
                    mode=resolved_mode,
                    dataset=resolved_dataset,
                )
                lock_repository.release_job_execution_lock(job_id)
                lock_conn.commit()

    def _execute_job_until_done_unlocked(
        self,
        *,
        job_id: UUID,
        mode: str | None = None,
        dataset: str | None = None,
        max_steps: int | None = None,
    ) -> int:
        processed = 0

        while True:
            if max_steps is not None and processed >= max_steps:
                break

            executed_dataset = self.execute_next_pending_step(mode=mode, dataset=dataset, job_id=job_id)
            if not executed_dataset:
                break

            processed += 1
            throttle_seconds = self._get_step_throttle_seconds(executed_dataset)
            if throttle_seconds > 0 and (max_steps is None or processed < max_steps):
                time.sleep(throttle_seconds)

        return processed

    def execute_pending_steps(
        self,
        *,
        mode: str | None = None,
        dataset: str | None = None,
        max_steps: int | None = None,
    ) -> int:
        processed = 0

        while True:
            if max_steps is not None and processed >= max_steps:
                break

            executed_dataset = self.execute_next_pending_step(mode=mode, dataset=dataset)
            if not executed_dataset:
                break

            processed += 1
            throttle_seconds = self._get_step_throttle_seconds(executed_dataset)
            if throttle_seconds > 0 and (max_steps is None or processed < max_steps):
                time.sleep(throttle_seconds)

        return processed
    def execute_next_pending_step(
        self,
        *,
        mode: str | None = None,
        dataset: str | None = None,
        job_id: UUID | None = None,
    ) -> str | None:
        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            step = repository.get_next_pending_step(mode=mode, dataset=dataset, job_id=job_id)
            if step is None:
                return None

            step_id = UUID(str(step['step_id']))
            current_job_id = UUID(str(step['job_id']))
            current_dataset = str(step['dataset'])
            repository.mark_job_running(current_job_id)
            repository.mark_step_running(step_id)
            conn.commit()

        try:
            self.execute_step(step)
        except Exception as exc:
            error_message = str(exc)[:4000]
            retry_decision = get_retry_decision(error_message, attempt=int(step['attempt']))
            with get_db_connection() as conn:
                repository = SyncRepository(conn)
                if repository.is_job_cancelled(current_job_id):
                    return current_dataset
                self._refresh_raw_resume_state(step_id=step_id)
                if retry_decision.should_retry and retry_decision.next_retry_at is not None:
                    repository.mark_step_for_retry(
                        step_id,
                        error_message=error_message,
                        next_retry_at=retry_decision.next_retry_at,
                    )
                    print(
                        f'step_id={step_id} status=retry_scheduled next_retry_at={retry_decision.next_retry_at.isoformat()} error={exc}',
                        file=sys.stderr,
                    )
                else:
                    repository.mark_step_failed(step_id, error_message=error_message)
                    print(f'step_id={step_id} status=failed error={exc}', file=sys.stderr)
                repository.refresh_job_status(current_job_id)
                conn.commit()
        else:
            with get_db_connection() as conn:
                repository = SyncRepository(conn)
                repository.mark_step_success(step_id)
                repository.refresh_job_status(current_job_id)
                conn.commit()
            print(f'step_id={step_id} status=success')

        return current_dataset

    def _get_step_throttle_seconds(self, dataset: str | None) -> int:
        if dataset == 'sales_funnel':
            return FUNNEL_STEP_THROTTLE_SECONDS
        return STEP_THROTTLE_SECONDS

    def execute_step(self, step: dict) -> None:
        dataset = str(step['dataset'])
        mode = str(step['mode'])
        payload_json = step.get('payload_json') or {}
        step_type = payload_json.get('step_type') if isinstance(payload_json, dict) else None

        if dataset == 'cards' and step_type == 'prepare':
            self._process_cards_prepare_step(step)
            return
        if dataset == 'adverts_snapshot' and step_type == 'prepare':
            self._process_adverts_snapshot_prepare_step(step)
            return
        if dataset == 'sales' and mode == 'weekly':
            self._process_sales_weekly_step(step)
            return
        if dataset == 'sales' and mode == 'daily' and step_type == 'open_week_dataset':
            self._process_sales_open_week_step(step)
            return
        if dataset == 'sales_funnel' and mode == 'weekly':
            self._process_sales_funnel_weekly_step(step)
            return
        if dataset == 'sales_funnel' and mode == 'daily' and step_type == 'open_week_dataset':
            self._process_sales_funnel_open_week_step(step)
            return
        if dataset == 'adverts_cost' and ((mode == 'weekly') or (mode == 'daily' and step_type == 'open_week_dataset')):
            self._process_adverts_cost_weekly_step(step)
            return
        if dataset == 'acceptance' and ((mode == 'weekly') or (mode == 'daily' and step_type == 'open_week_dataset')):
            self._process_acceptance_weekly_step(step)
            return
        if dataset == 'storage' and ((mode == 'weekly') or (mode == 'daily' and step_type == 'open_week_dataset')):
            self._process_storage_weekly_step(step)
            return
        if dataset == 'warehouse_remains' and mode == 'daily':
            self._process_warehouse_remains_snapshot_step(step)
            return

        raise RuntimeError(f'Unsupported sync step: dataset={dataset} mode={mode}')

    def _run_command(self, command: list[str], *, job_id: UUID) -> None:
        process = subprocess.Popen(
            command,
            cwd=self._root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout = ''
        stderr = ''
        while True:
            try:
                stdout, stderr = process.communicate(timeout=1)
                break
            except subprocess.TimeoutExpired:
                if self._is_job_cancelled(job_id):
                    process.terminate()
                    try:
                        stdout, stderr = process.communicate(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        stdout, stderr = process.communicate()
                    raise RuntimeError('Sync job cancelled by user')

        if stdout:
            print(stdout, end='')
        if stderr:
            print(stderr, file=sys.stderr, end='')
        if process.returncode != 0:
            details = self._build_command_error_details(stdout, stderr)
            message = f"Command failed with exit code {process.returncode}: {' '.join(command)}"
            if details:
                message = f'{message}\n{details}'
            raise RuntimeError(message)

    def _build_command_error_details(self, stdout: str, stderr: str) -> str:
        chunks: list[str] = []
        if stderr.strip():
            chunks.append(f'stderr:\n{self._tail_text(stderr)}')
        if stdout.strip():
            chunks.append(f'stdout:\n{self._tail_text(stdout)}')
        return '\n'.join(chunks)

    def _tail_text(self, value: str, *, max_lines: int = 20, max_chars: int = 2000) -> str:
        lines = value.strip().splitlines()
        tail = '\n'.join(lines[-max_lines:])
        if len(tail) > max_chars:
            tail = tail[-max_chars:]
        return tail

    def _process_cards_prepare_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю карточки из WB API',
            phase_detail='WB content API: получаю актуальный snapshot карточек продавца.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_cards_list_courier',
            '--account-id',
            account_id,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю карточки в core',
            phase_detail='Читаю raw snapshot карточек и обновляю core.product_cards и связанные таблицы.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_cards_list_loader',
            '--account-id',
            account_id,
        ], job_id=job_id)

    def _process_adverts_snapshot_prepare_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю рекламные кампании из WB API',
            phase_detail='WB advert API: получаю актуальный snapshot рекламных кампаний и их связей с карточками.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_adverts_courier',
            '--account-id',
            account_id,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю рекламные кампании в core',
            phase_detail='Читаю raw snapshot кампаний и обновляю core.adverts и core.advert_nms.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_adverts_loader',
            '--account-id',
            account_id,
        ], job_id=job_id)

    def _process_sales_weekly_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        raw_resume = self._ensure_raw_resume(step_id, payload_json)
        is_resume = int(raw_resume.get('rows_loaded', 0)) > 0 or int(raw_resume.get('next_rrdid', 0)) > 0

        phase_detail = (
            'WB statistics API: reportDetailByPeriod, '
            f'weekly, период {period_from} .. {period_to}. Жду ответ от Wildberries.'
        )
        if is_resume:
            phase_detail = (
                'WB statistics API: reportDetailByPeriod, '
                f'weekly, период {period_from} .. {period_to}. '
                f"Продолжаю с rrdid={raw_resume['next_rrdid']} после уже сохранённых {raw_resume.get('rows_loaded', 0)} строк."
            )

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю raw из WB API',
            phase_detail=phase_detail,
        )
        command = [
            self._python_executable,
            '-m',
            'courier.wb_raw_courier',
            '--account-id',
            account_id,
            '--mode',
            'weekly',
            '--date-from',
            period_from,
            '--date-to',
            period_to,
            '--load-id',
            str(raw_resume['load_id']),
            '--rrdid-start',
            str(raw_resume.get('next_rrdid', 0)),
            '--rows-loaded-start',
            str(raw_resume.get('rows_loaded', 0)),
        ]
        self._run_command(command, job_id=UUID(str(step['job_id'])))
        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю weekly данные в core',
            phase_detail='Читаю raw payload и записываю weekly строки в core.report_detail_weekly.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_report_detail_loader',
            '--account-id',
            account_id,
            '--mode',
            'weekly',
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=UUID(str(step['job_id'])))
        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления weekly core-данных.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=UUID(str(step['job_id'])))

    def _process_sales_open_week_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        raw_resume = self._ensure_raw_resume(step_id, payload_json)
        is_resume = int(raw_resume.get('rows_loaded', 0)) > 0 or int(raw_resume.get('next_rrdid', 0)) > 0

        phase_detail = (
            'WB statistics API: reportDetailByPeriod, '
            f'daily, незакрытая неделя {period_from} .. {period_to}. Жду ответ от Wildberries.'
        )
        if is_resume:
            phase_detail = (
                'WB statistics API: reportDetailByPeriod, '
                f'daily, незакрытая неделя {period_from} .. {period_to}. '
                f"Продолжаю с rrdid={raw_resume['next_rrdid']} после уже сохранённых {raw_resume.get('rows_loaded', 0)} строк."
            )

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю незакрытую неделю продаж из WB API',
            phase_detail=phase_detail,
        )
        command = [
            self._python_executable,
            '-m',
            'courier.wb_raw_courier',
            '--account-id',
            account_id,
            '--mode',
            'daily',
            '--date-from',
            period_from,
            '--date-to',
            period_to,
            '--load-id',
            str(raw_resume['load_id']),
            '--rrdid-start',
            str(raw_resume.get('next_rrdid', 0)),
            '--rows-loaded-start',
            str(raw_resume.get('rows_loaded', 0)),
        ]
        self._run_command(command, job_id=UUID(str(step['job_id'])))
        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю незакрытую неделю продаж в core',
            phase_detail='Читаю raw payload и записываю daily строки в core.report_detail_daily.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_report_detail_loader',
            '--account-id',
            account_id,
            '--mode',
            'daily',
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=UUID(str(step['job_id'])))
        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления daily продаж незакрытой недели.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=UUID(str(step['job_id'])))


    def _process_sales_funnel_open_week_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю воронку продаж незакрытой недели из WB API',
            phase_detail=f'WB seller analytics API: загружаю sales funnel products за день {period_from}.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_sales_funnel_products_courier',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю воронку продаж незакрытой недели в core',
            phase_detail='Читаю raw funnel analytics и обновляю core.product_funnel по этому дню.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_sales_funnel_products_loader',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления daily product funnel незакрытой недели.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=job_id)

    def _process_sales_funnel_weekly_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from_value = step['period_from']
        period_to_value = step['period_to']
        period_from = period_from_value.isoformat()
        period_to = period_to_value.isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю воронку продаж из WB API',
            phase_detail=f'WB seller analytics API: загружаю sales funnel products по дням внутри недели {period_from} .. {period_to}.',
        )
        current_day = period_from_value
        while current_day <= period_to_value:
            current_day_iso = current_day.isoformat()
            self._run_command([
                self._python_executable,
                '-m',
                'courier.wb_sales_funnel_products_courier',
                '--account-id',
                account_id,
                '--date-from',
                current_day_iso,
                '--date-to',
                current_day_iso,
            ], job_id=job_id)
            current_day += timedelta(days=1)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю воронку продаж в core',
            phase_detail='Читаю raw funnel analytics и обновляю core.product_funnel по каждому дню этой недели.',
        )
        current_day = period_from_value
        while current_day <= period_to_value:
            current_day_iso = current_day.isoformat()
            self._run_command([
                self._python_executable,
                '-m',
                'courier.wb_sales_funnel_products_loader',
                '--account-id',
                account_id,
                '--date-from',
                current_day_iso,
                '--date-to',
                current_day_iso,
            ], job_id=job_id)
            current_day += timedelta(days=1)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления weekly sales и product funnel.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=job_id)

    def _process_adverts_cost_weekly_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю расходы на рекламу из WB API',
            phase_detail=f'WB advert API: загружаю дневные рекламные расходы за {period_from} .. {period_to}.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_adv_upd_courier',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю расходы на рекламу в core',
            phase_detail='Читаю raw daily spend и обновляю core.advert_costs за даты этой недели.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_adv_upd_loader',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления weekly sales и daily advert cost.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=job_id)

    def _process_acceptance_weekly_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю платную приёмку из WB API',
            phase_detail=f'WB seller analytics API: загружаю acceptance report за {period_from} .. {period_to}.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_acceptance_report_courier',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю платную приёмку в core',
            phase_detail='Читаю raw acceptance report и обновляю core.acceptance_costs за даты этой недели.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_acceptance_report_loader',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления weekly sales, advert cost и acceptance cost.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=job_id)

    def _process_storage_weekly_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        period_from = step['period_from'].isoformat()
        period_to = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю платное хранение из WB API',
            phase_detail=f'WB seller analytics API: загружаю paid storage report за {period_from} .. {period_to}.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_paid_storage_courier',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю платное хранение в core',
            phase_detail='Читаю raw paid storage report и обновляю core.paid_storage_costs за даты этой недели.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_paid_storage_loader',
            '--account-id',
            account_id,
            '--date-from',
            period_from,
            '--date-to',
            period_to,
        ], job_id=job_id)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю витрины mart',
                phase_detail='Пересчитываю витрины экономики после обновления weekly sales, advert cost, acceptance cost и paid storage cost.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_MARTS),
            ], job_id=job_id)

    def _process_warehouse_remains_snapshot_step(self, step: dict) -> None:
        step_id = UUID(str(step['step_id']))
        account_id = str(step['account_id'])
        snapshot_day = step['period_to'].isoformat()
        payload_json = step.get('payload_json') or {}
        job_id = UUID(str(step['job_id']))

        self._set_step_phase(
            step_id,
            phase='raw',
            phase_label='Загружаю snapshot остатков из WB API',
            phase_detail=f'WB seller analytics API: получаю актуальный snapshot warehouse remains на {snapshot_day}.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_warehouse_remains_courier',
            '--account-id',
            account_id,
        ], job_id=job_id)

        self._set_step_phase(
            step_id,
            phase='core',
            phase_label='Сохраняю snapshot остатков в core',
            phase_detail='Читаю raw snapshot warehouse remains и обновляю core.warehouse_remains_items и core.warehouse_remains_balances.',
        )
        self._run_command([
            self._python_executable,
            '-m',
            'courier.wb_warehouse_remains_loader',
            '--account-id',
            account_id,
        ], job_id=job_id)

        if payload_json.get('run_marts_after', True):
            self._set_step_phase(
                step_id,
                phase='marts',
                phase_label='Обновляю stock витрины mart',
                phase_detail='Пересчитываю serving-витрины остатков после обновления snapshot warehouse remains.',
            )
            self._run_command([
                self._python_executable,
                str(REFRESH_STOCK_MARTS),
            ], job_id=job_id)

    def _is_job_cancelled(self, job_id: UUID) -> str | None:
        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            return repository.is_job_cancelled(job_id)

    def _set_step_phase(self, step_id: UUID, *, phase: str, phase_label: str, phase_detail: str | None = None) -> None:
        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            repository.update_step_payload(
                step_id,
                {
                    'phase': phase,
                    'phase_label': phase_label,
                    'phase_detail': phase_detail,
                },
            )
            conn.commit()

    def _ensure_raw_resume(self, step_id: UUID, payload_json: dict) -> dict:
        raw_resume = payload_json.get('raw_resume') if isinstance(payload_json, dict) else None
        if isinstance(raw_resume, dict) and raw_resume.get('load_id'):
            return {
                'load_id': raw_resume['load_id'],
                'next_rrdid': int(raw_resume.get('next_rrdid', 0) or 0),
                'rows_loaded': int(raw_resume.get('rows_loaded', 0) or 0),
            }

        raw_resume = {
            'load_id': str(uuid4()),
            'next_rrdid': 0,
            'rows_loaded': 0,
        }
        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            repository.update_step_payload(step_id, {'raw_resume': raw_resume})
            conn.commit()
        return raw_resume

    def _refresh_raw_resume_state(self, *, step_id: UUID) -> dict | None:
        with get_db_connection() as conn:
            row_repository = SyncRepository(conn)
            step_row = row_repository.get_step(step_id)
            payload_json = (step_row or {}).get('payload_json') if step_row is not None else None
            raw_resume = payload_json.get('raw_resume') if isinstance(payload_json, dict) else None
            if not isinstance(raw_resume, dict) or not raw_resume.get('load_id'):
                return None
            state = row_repository.get_raw_resume_state(load_id=UUID(str(raw_resume['load_id'])))
            if state is None:
                return None
            row_repository.update_step_payload(step_id, {'raw_resume': state})
            conn.commit()
            return state


