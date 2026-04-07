from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
import psycopg

from courier.common import get_week_start
from backend.app.modules.sync.executor import SyncExecutor
from backend.app.modules.sync.repository import SyncRepository
from backend.app.modules.sync.schemas import (
    SyncDataset,
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
    SyncJobRead,
    SyncJobStatus,
    SyncJobStepRead,
    SyncJobStepStatus,
    SyncJobType,
    SyncMode,
)


class SyncService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn
        self._repository = SyncRepository(conn)

    def create_job(self, payload: SyncJobCreate, *, user_id: UUID) -> SyncJobCreateResponse:
        self._ensure_account_access(user_id=user_id, account_id=payload.account_id)
        if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for sales backfill')
            return self._create_initial_sales_job(payload)
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for funnel backfill')
            return self._create_sales_funnel_job(payload)
        if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH:
            if payload.mode != SyncMode.DAILY:
                raise HTTPException(status_code=400, detail='Stock snapshot refresh supports only daily mode')
            return self._create_stock_snapshot_job(payload)
        if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
            if payload.mode != SyncMode.DAILY:
                raise HTTPException(status_code=400, detail='Open week refresh supports only daily mode')
            return self._create_open_week_job(payload)
        raise HTTPException(status_code=400, detail='Unsupported job type for MVP')

    def continue_job(self, payload: SyncJobCreate, *, user_id: UUID) -> SyncJobCreateResponse:
        self._ensure_account_access(user_id=user_id, account_id=payload.account_id)
        if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for sales backfill')
            return self._continue_initial_sales_job(payload)
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for funnel backfill')
            return self._continue_sales_funnel_job(payload)
        if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH:
            raise HTTPException(status_code=400, detail='Stock snapshot refresh does not support continue; start a fresh snapshot job instead.')
        if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
            raise HTTPException(status_code=400, detail='Open week refresh does not support continue; start a fresh open-week job instead.')
        raise HTTPException(status_code=400, detail='Unsupported job type for MVP')

    def _create_initial_sales_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_initial_sales_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется weekly-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Сейчас нельзя молча подменять её новой job. Дождитесь завершения текущей job '
                    'или остановите её, затем запустите выбранный период.'
                ),
            )

        weekly_ranges = self._build_closed_week_ranges(payload.date_from, payload.date_to)
        weekly_step_plan = self._build_weekly_step_plan(weekly_ranges=weekly_ranges, datasets=effective_datasets)
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=SyncDataset.CARDS in effective_datasets,
            include_adverts_snapshot_prepare=SyncDataset.ADVERTS_SNAPSHOT in effective_datasets,
        )

    def _create_sales_funnel_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_sales_funnel_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES_FUNNEL.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется funnel-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Дождитесь завершения текущей funnel job или остановите её, затем запустите новый период.'
                ),
            )

        daily_ranges = self._build_closed_day_ranges(payload.date_from, payload.date_to)
        weekly_step_plan = [
            (period_from, period_to, [SyncDataset.SALES_FUNNEL])
            for period_from, period_to in daily_ranges
        ]
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def _create_open_week_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_open_week_datasets(payload.datasets)
        open_week_from, open_week_to = self._build_open_week_range(payload.date_to)
        effective_payload = SyncJobCreate(
            account_id=payload.account_id,
            job_type=payload.job_type,
            mode=payload.mode,
            date_from=open_week_from,
            date_to=open_week_to,
            datasets=effective_datasets,
        )

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None and active_job['job_type'] == SyncJobType.OPEN_WEEK_REFRESH.value:
            if active_job['date_from'] == open_week_from and active_job['date_to'] == open_week_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )
            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется обновление незакрытой недели: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). Дождитесь завершения текущей job или остановите её."
                ),
            )

        open_week_plan = [
            (
                open_week_from,
                open_week_to,
                [
                    dataset
                    for dataset in effective_datasets
                    if dataset in {SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
                ],
            )
        ]
        if SyncDataset.SALES_FUNNEL in effective_datasets:
            cursor = open_week_from
            while cursor <= open_week_to:
                open_week_plan.append((cursor, cursor, [SyncDataset.SALES_FUNNEL]))
                cursor += timedelta(days=1)
        return self._create_job_with_plan(
            payload=effective_payload,
            weekly_step_plan=open_week_plan,
            datasets=effective_datasets,
            include_cards_prepare=True,
            include_adverts_snapshot_prepare=True,
        )

    def _create_stock_snapshot_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_stock_snapshot_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.WAREHOUSE_REMAINS.value,
        )
        if active_job is not None:
            return SyncJobCreateResponse(
                job_id=active_job['job_id'],
                status=SyncJobStatus(active_job['status']),
            )

        snapshot_day = payload.date_to
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=[(snapshot_day, snapshot_day, [SyncDataset.WAREHOUSE_REMAINS])],
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def _continue_initial_sales_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_initial_sales_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется weekly-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Сейчас нельзя молча подменять её новой job. Дождитесь завершения текущей job '
                    'или остановите её, затем продолжите выбранный период.'
                ),
            )

        weekly_ranges = self._build_closed_week_ranges(payload.date_from, payload.date_to)
        successful_periods_by_dataset = {
            dataset: {
                (row['period_from'], row['period_to'])
                for row in self._repository.list_successful_step_periods_for_account(
                    payload.account_id,
                    mode=payload.mode.value,
                    dataset=dataset.value,
                    date_from=payload.date_from,
                    date_to=payload.date_to,
                    job_type=payload.job_type.value,
                )
            }
            for dataset in (SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE)
        }

        weekly_step_plan: list[tuple[date, date, list[SyncDataset]]] = []
        for period_from, period_to in weekly_ranges:
            remaining_datasets = [
                dataset
                for dataset in (SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE)
                if (period_from, period_to) not in successful_periods_by_dataset[dataset]
            ]
            if remaining_datasets:
                weekly_step_plan.append((period_from, period_to, remaining_datasets))

        include_cards_prepare = not self._repository.has_successful_prepare_step_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.CARDS.value,
            job_type=payload.job_type.value,
        )
        include_adverts_snapshot_prepare = not self._repository.has_successful_prepare_step_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.ADVERTS_SNAPSHOT.value,
            job_type=payload.job_type.value,
        )

        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            raise HTTPException(status_code=400, detail='Все закрытые недели в выбранном периоде уже успешно загружены.')

        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=include_cards_prepare,
            include_adverts_snapshot_prepare=include_adverts_snapshot_prepare,
        )

    def _continue_sales_funnel_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_sales_funnel_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES_FUNNEL.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется funnel-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Дождитесь завершения текущей funnel job или остановите её, затем продолжите выбранный период.'
                ),
            )

        daily_ranges = self._build_closed_day_ranges(payload.date_from, payload.date_to)
        successful_days = {
            (row['period_from'], row['period_to'])
            for row in self._repository.list_successful_step_periods_for_account(
                payload.account_id,
                mode=payload.mode.value,
                dataset=SyncDataset.SALES_FUNNEL.value,
                date_from=payload.date_from,
                date_to=payload.date_to,
                job_type=payload.job_type.value,
            )
        }
        weekly_step_plan = [
            (period_from, period_to, [SyncDataset.SALES_FUNNEL])
            for period_from, period_to in daily_ranges
            if (period_from, period_to) not in successful_days
        ]

        if not weekly_step_plan:
            raise HTTPException(status_code=400, detail='Все закрытые дни воронки в выбранном периоде уже успешно загружены.')

        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def get_job_details(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        step_rows = self._repository.list_job_steps(job_id)
        return SyncJobDetailsResponse(
            job=SyncJobRead.model_validate(job_row),
            steps=[SyncJobStepRead.model_validate(row) for row in step_rows],
        )

    def _create_job_with_plan(
        self,
        *,
        payload: SyncJobCreate,
        weekly_step_plan: list[tuple[date, date, list[SyncDataset]]],
        datasets: list[SyncDataset],
        include_cards_prepare: bool,
        include_adverts_snapshot_prepare: bool,
    ) -> SyncJobCreateResponse:
        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            detail = 'No closed full weeks found in the selected period'
            if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
                detail = 'No open-week steps found for the selected period'
            raise HTTPException(status_code=400, detail=detail)

        job_id = uuid4()
        job_row = self._repository.create_job(
            job_id=job_id,
            account_id=payload.account_id,
            job_type=payload.job_type.value,
            mode=payload.mode.value,
            date_from=payload.date_from,
            date_to=payload.date_to,
            status=SyncJobStatus.PENDING.value,
            datasets=[dataset.value for dataset in datasets],
        )

        if include_cards_prepare:
            self._repository.create_step(
                step_id=uuid4(),
                job_id=job_id,
                dataset=SyncDataset.CARDS.value,
                period_from=payload.date_from,
                period_to=payload.date_to,
                status=SyncJobStepStatus.PENDING.value,
                payload_json={
                    'job_type': payload.job_type.value,
                    'mode': payload.mode.value,
                    'step_type': 'prepare',
                    'restart_from_progress': True,
                },
            )

        if include_adverts_snapshot_prepare:
            self._repository.create_step(
                step_id=uuid4(),
                job_id=job_id,
                dataset=SyncDataset.ADVERTS_SNAPSHOT.value,
                period_from=payload.date_from,
                period_to=payload.date_to,
                status=SyncJobStepStatus.PENDING.value,
                payload_json={
                    'job_type': payload.job_type.value,
                    'mode': payload.mode.value,
                    'step_type': 'prepare',
                    'restart_from_progress': True,
                },
            )

        for period_from, period_to, weekly_datasets in weekly_step_plan:
            for weekly_dataset in weekly_datasets:
                self._repository.create_step(
                    step_id=uuid4(),
                    job_id=job_id,
                    dataset=weekly_dataset.value,
                    period_from=period_from,
                    period_to=period_to,
                    status=SyncJobStepStatus.PENDING.value,
                    payload_json={
                        'job_type': payload.job_type.value,
                        'mode': payload.mode.value,
                        'step_type': 'snapshot' if weekly_dataset == SyncDataset.WAREHOUSE_REMAINS else 'open_week_dataset' if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH else 'weekly_dataset',
                        'run_marts_after': weekly_dataset == SyncDataset.WAREHOUSE_REMAINS or weekly_dataset == SyncDataset.STORAGE or (weekly_dataset == SyncDataset.ACCEPTANCE and SyncDataset.STORAGE not in weekly_datasets) or (weekly_dataset == SyncDataset.ADVERTS_COST and SyncDataset.ACCEPTANCE not in weekly_datasets and SyncDataset.STORAGE not in weekly_datasets) or (weekly_dataset == SyncDataset.SALES_FUNNEL and period_to == payload.date_to) or (weekly_dataset == SyncDataset.SALES and SyncDataset.SALES_FUNNEL not in datasets and SyncDataset.ADVERTS_COST not in weekly_datasets and SyncDataset.ACCEPTANCE not in weekly_datasets and SyncDataset.STORAGE not in weekly_datasets),
                        'restart_from_progress': True,
                    },
                )

        self._conn.commit()
        return SyncJobCreateResponse(job_id=job_row['job_id'], status=SyncJobStatus(job_row['status']))

    def should_resume_job(self, job_id: UUID, *, user_id: UUID) -> bool:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        if job_row['status'] != SyncJobStatus.RUNNING.value:
            return False

        recovered = self._repository.recover_timed_out_running_steps(job_id=job_id)
        if recovered > 0:
            self._repository.refresh_job_status(job_id)
            self._conn.commit()

        return self._repository.get_next_pending_step(job_id=job_id) is not None

    def run_job(self, job_id: UUID, *, user_id: UUID, max_steps: int = 1) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        executor = SyncExecutor()
        dataset = (
            SyncDataset.SALES_FUNNEL.value
            if job_row['job_type'] == SyncJobType.SALES_FUNNEL_BACKFILL.value
            else SyncDataset.WAREHOUSE_REMAINS.value if job_row['job_type'] == SyncJobType.STOCK_SNAPSHOT_REFRESH.value else None
        )
        executor.execute_job_until_done(job_id=job_id, dataset=dataset, max_steps=max_steps)

        return self.get_job_details(job_id, user_id=user_id)

    def retry_failed_steps(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        self._repository.reset_failed_steps(job_id)
        self._repository.refresh_job_status(job_id)
        self._conn.commit()
        return self.get_job_details(job_id, user_id=user_id)

    def cancel_job(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        self._repository.cancel_job(job_id)
        self._conn.commit()
        return self.get_job_details(job_id, user_id=user_id)

    def restart_job(self, job_id: UUID, *, user_id: UUID) -> SyncJobCreateResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        step_rows = self._repository.list_job_steps(job_id)
        weekly_step_datasets: dict[tuple[date, date], list[SyncDataset]] = {}
        for step in step_rows:
            if step['dataset'] not in {SyncDataset.SALES.value, SyncDataset.SALES_FUNNEL.value, SyncDataset.ADVERTS_COST.value, SyncDataset.ACCEPTANCE.value, SyncDataset.STORAGE.value, SyncDataset.WAREHOUSE_REMAINS.value}:
                continue
            if step['status'] == SyncJobStepStatus.SUCCESS.value:
                continue
            key = (step['period_from'], step['period_to'])
            weekly_step_datasets.setdefault(key, [])
            dataset_enum = SyncDataset(step['dataset'])
            if dataset_enum not in weekly_step_datasets[key]:
                weekly_step_datasets[key].append(dataset_enum)
        weekly_step_plan = [
            (period_from, period_to, datasets_for_week)
            for (period_from, period_to), datasets_for_week in sorted(weekly_step_datasets.items(), key=lambda item: item[0][0], reverse=True)
        ]
        include_cards_prepare = any(
            step['dataset'] == SyncDataset.CARDS.value and step['status'] != SyncJobStepStatus.SUCCESS.value
            for step in step_rows
        )
        include_adverts_snapshot_prepare = any(
            step['dataset'] == SyncDataset.ADVERTS_SNAPSHOT.value and step['status'] != SyncJobStepStatus.SUCCESS.value
            for step in step_rows
        )

        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            raise HTTPException(status_code=400, detail='Эта job уже полностью загружена, перезапускать нечего.')

        if job_row['status'] in (SyncJobStatus.PENDING.value, SyncJobStatus.RUNNING.value):
            self._repository.cancel_job(job_id, reason='Cancelled by restart request')
            self._conn.commit()

        payload = SyncJobCreate(
            account_id=job_row['account_id'],
            job_type=SyncJobType(job_row['job_type']),
            mode=SyncMode(job_row['mode']),
            date_from=job_row['date_from'],
            date_to=job_row['date_to'],
            datasets=[SyncDataset(value) for value in job_row['datasets']],
        )
        effective_datasets = (
            self._normalize_initial_sales_datasets(payload.datasets)
            if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL
            else self._normalize_sales_funnel_datasets(payload.datasets) if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
            else self._normalize_open_week_datasets(payload.datasets) if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH
            else self._normalize_stock_snapshot_datasets(payload.datasets)
        )
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=include_cards_prepare,
            include_adverts_snapshot_prepare=include_adverts_snapshot_prepare,
        )

    def _ensure_account_access(self, *, user_id: UUID, account_id: UUID) -> None:
        if not self._repository.user_has_account_access(user_id=user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    def _normalize_initial_sales_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES, SyncDataset.CARDS, SyncDataset.ADVERTS_SNAPSHOT, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='MVP supports only sales, cards, adverts_snapshot, adverts_cost, acceptance and storage datasets for initial sales backfill')
        if SyncDataset.SALES not in unique:
            raise HTTPException(status_code=400, detail='Sales is required for weekly sync jobs')
        if SyncDataset.CARDS not in unique:
            unique.append(SyncDataset.CARDS)
        if SyncDataset.ADVERTS_SNAPSHOT not in unique:
            unique.append(SyncDataset.ADVERTS_SNAPSHOT)
        if SyncDataset.ADVERTS_COST not in unique:
            unique.append(SyncDataset.ADVERTS_COST)
        if SyncDataset.ACCEPTANCE not in unique:
            unique.append(SyncDataset.ACCEPTANCE)
        if SyncDataset.STORAGE not in unique:
            unique.append(SyncDataset.STORAGE)
        if SyncDataset.SALES_FUNNEL not in unique:
            unique.append(SyncDataset.SALES_FUNNEL)
        return unique

    def _normalize_sales_funnel_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES_FUNNEL}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='MVP supports only sales_funnel dataset for funnel backfill')
        if unique != [SyncDataset.SALES_FUNNEL]:
            return [SyncDataset.SALES_FUNNEL]
        return unique

    def _normalize_stock_snapshot_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.WAREHOUSE_REMAINS}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='Stock snapshot refresh supports only warehouse_remains dataset')
        return [SyncDataset.WAREHOUSE_REMAINS]

    def _normalize_open_week_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES, SyncDataset.SALES_FUNNEL, SyncDataset.CARDS, SyncDataset.ADVERTS_SNAPSHOT, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='Open week refresh supports only sales, sales_funnel, cards, adverts_snapshot, adverts_cost, acceptance and storage datasets')
        if SyncDataset.SALES not in unique:
            raise HTTPException(status_code=400, detail='Sales is required for open week refresh')
        if SyncDataset.CARDS not in unique:
            unique.append(SyncDataset.CARDS)
        if SyncDataset.ADVERTS_SNAPSHOT not in unique:
            unique.append(SyncDataset.ADVERTS_SNAPSHOT)
        if SyncDataset.ADVERTS_COST not in unique:
            unique.append(SyncDataset.ADVERTS_COST)
        if SyncDataset.ACCEPTANCE not in unique:
            unique.append(SyncDataset.ACCEPTANCE)
        if SyncDataset.STORAGE not in unique:
            unique.append(SyncDataset.STORAGE)
        if SyncDataset.SALES_FUNNEL not in unique:
            unique.append(SyncDataset.SALES_FUNNEL)
        return unique

    def _build_weekly_step_plan(
        self,
        *,
        weekly_ranges: list[tuple[date, date]],
        datasets: list[SyncDataset],
    ) -> list[tuple[date, date, list[SyncDataset]]]:
        weekly_datasets = [dataset for dataset in datasets if dataset in {SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE, SyncDataset.WAREHOUSE_REMAINS}]
        return [
            (period_from, period_to, list(weekly_datasets))
            for period_from, period_to in weekly_ranges
        ]

    def _build_closed_day_ranges(self, date_from: date, date_to: date) -> list[tuple[date, date]]:
        weekly_ranges = self._build_closed_week_ranges(date_from, date_to)
        day_ranges: list[tuple[date, date]] = []
        for week_start, week_end in weekly_ranges:
            cursor = week_start
            while cursor <= week_end:
                day_ranges.append((cursor, cursor))
                cursor += timedelta(days=1)
        return day_ranges

    def _build_closed_week_ranges(self, date_from: date, date_to: date) -> list[tuple[date, date]]:
        today = date.today()
        current_week_start = get_week_start(today)
        last_closed_day = current_week_start - timedelta(days=1)
        effective_date_to = min(date_to, last_closed_day)
        if date_from > effective_date_to:
            return []

        first_week_start = get_week_start(date_from)
        if first_week_start < date_from:
            first_week_start += timedelta(days=7)

        last_week_start = get_week_start(effective_date_to)
        last_week_end = last_week_start + timedelta(days=6)
        if last_week_end > effective_date_to:
            last_week_start -= timedelta(days=7)

        if first_week_start > last_week_start:
            return []

        ranges: list[tuple[date, date]] = []
        cursor = first_week_start
        while cursor <= last_week_start:
            ranges.append((cursor, cursor + timedelta(days=6)))
            cursor += timedelta(days=7)
        return ranges

    def _build_open_week_range(self, anchor_date: date) -> tuple[date, date]:
        today = date.today()
        effective_anchor = min(anchor_date, today)
        open_week_start = get_week_start(effective_anchor)
        return open_week_start, effective_anchor
