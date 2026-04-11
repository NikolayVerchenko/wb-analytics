import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import psycopg

RUNNING_STEP_TIMEOUT = timedelta(minutes=10)


class SyncRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def user_has_account_access(self, *, user_id: UUID, account_id: UUID) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select exists(
                    select 1
                    from core.user_accounts
                    where user_id = %s
                      and account_id = %s
                ) as has_access
                """,
                (user_id, account_id),
            )
            row = cur.fetchone()
        return bool(row['has_access']) if row is not None else False

    def create_job(
        self,
        *,
        job_id: UUID,
        account_id: UUID,
        job_type: str,
        mode: str,
        date_from,
        date_to,
        status: str,
        datasets: list[str],
    ) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.sync_jobs (
                    job_id,
                    account_id,
                    job_type,
                    mode,
                    date_from,
                    date_to,
                    status,
                    datasets
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                returning
                    job_id,
                    account_id,
                    job_type,
                    mode,
                    date_from,
                    date_to,
                    status,
                    datasets,
                    error_message,
                    created_at,
                    started_at,
                    finished_at
                """,
                (job_id, account_id, job_type, mode, date_from, date_to, status, json.dumps(datasets)),
            )
            return cur.fetchone()

    def try_acquire_job_execution_lock(self, job_id: UUID) -> bool:
        lock_key = self._job_lock_key(job_id)
        with self._conn.cursor() as cur:
            cur.execute('select pg_try_advisory_lock(%s) as acquired', (lock_key,))
            row = cur.fetchone()
        return bool(row['acquired']) if row is not None else False

    def release_job_execution_lock(self, job_id: UUID) -> None:
        lock_key = self._job_lock_key(job_id)
        with self._conn.cursor() as cur:
            cur.execute('select pg_advisory_unlock(%s)', (lock_key,))

    def try_acquire_account_execution_lock(self, account_id: UUID, *, mode: str, dataset: str) -> bool:
        lock_key = self._account_lock_key(account_id, mode=mode, dataset=dataset)
        with self._conn.cursor() as cur:
            cur.execute('select pg_try_advisory_lock(%s) as acquired', (lock_key,))
            row = cur.fetchone()
        return bool(row['acquired']) if row is not None else False

    def release_account_execution_lock(self, account_id: UUID, *, mode: str, dataset: str) -> None:
        lock_key = self._account_lock_key(account_id, mode=mode, dataset=dataset)
        with self._conn.cursor() as cur:
            cur.execute('select pg_advisory_unlock(%s)', (lock_key,))

    def create_step(
        self,
        *,
        step_id: UUID,
        job_id: UUID,
        dataset: str,
        period_from,
        period_to,
        status: str,
        attempt: int = 1,
        payload_json: dict | None = None,
    ) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.sync_job_steps (
                    step_id,
                    job_id,
                    dataset,
                    period_from,
                    period_to,
                    status,
                    attempt,
                    payload_json
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                returning
                    step_id,
                    job_id,
                    dataset,
                    period_from,
                    period_to,
                    status,
                    attempt,
                    error_message,
                    payload_json,
                    next_retry_at,
                    started_at,
                    finished_at
                """,
                (
                    step_id,
                    job_id,
                    dataset,
                    period_from,
                    period_to,
                    status,
                    attempt,
                    json.dumps(payload_json) if payload_json is not None else None,
                ),
            )
            return cur.fetchone()

    def get_job(self, job_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    job_id,
                    account_id,
                    job_type,
                    mode,
                    date_from,
                    date_to,
                    status,
                    datasets,
                    error_message,
                    created_at,
                    started_at,
                    finished_at
                from core.sync_jobs
                where job_id = %s
                """,
                (job_id,),
            )
            return cur.fetchone()

    def is_job_cancelled(self, job_id: UUID) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "select status = 'cancelled' as is_cancelled from core.sync_jobs where job_id = %s",
                (job_id,),
            )
            row = cur.fetchone()
            return bool(row['is_cancelled']) if row is not None else False

    def cancel_job(self, job_id: UUID, *, reason: str = 'Cancelled by user') -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_jobs
                set status = 'cancelled',
                    finished_at = now(),
                    error_message = %s
                where job_id = %s
                  and status <> 'cancelled'
                """,
                (reason, job_id),
            )
            job_updates = cur.rowcount
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'cancelled',
                    finished_at = now(),
                    next_retry_at = null,
                    error_message = coalesce(error_message, %s)
                where job_id = %s
                  and status in ('pending', 'running')
                """,
                (reason, job_id),
            )
        return job_updates

    def get_step(self, step_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    step_id,
                    job_id,
                    dataset,
                    period_from,
                    period_to,
                    status,
                    attempt,
                    error_message,
                    payload_json,
                    next_retry_at,
                    started_at,
                    finished_at
                from core.sync_job_steps
                where step_id = %s
                """,
                (step_id,),
            )
            return cur.fetchone()

    def list_job_steps(self, job_id: UUID) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    step_id,
                    job_id,
                    dataset,
                    period_from,
                    period_to,
                    status,
                    attempt,
                    error_message,
                    payload_json,
                    next_retry_at,
                    started_at,
                    finished_at
                from core.sync_job_steps
                where job_id = %s
                """,
                (job_id,),
            )
            rows = list(cur.fetchall())
        return sorted(rows, key=self._step_sort_key)

    def get_active_job_for_account(self, account_id: UUID, *, mode: str, dataset: str) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    job_id,
                    account_id,
                    job_type,
                    mode,
                    date_from,
                    date_to,
                    status,
                    datasets,
                    error_message,
                    created_at,
                    started_at,
                    finished_at
                from core.sync_jobs
                where account_id = %s
                  and mode = %s
                  and status in ('pending', 'running')
                  and datasets ? %s
                order by created_at desc
                limit 1
                """,
                (account_id, mode, dataset),
            )
            return cur.fetchone()

    def list_active_jobs_for_account(self, account_id: UUID) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    job_id,
                    account_id,
                    job_type,
                    mode,
                    date_from,
                    date_to,
                    status,
                    datasets,
                    error_message,
                    created_at,
                    started_at,
                    finished_at
                from core.sync_jobs
                where account_id = %s
                  and status in ('pending', 'running')
                order by created_at desc
                """,
                (account_id,),
            )
            return list(cur.fetchall())

    def list_successful_step_periods_for_account(
        self,
        account_id: UUID,
        *,
        mode: str,
        dataset: str,
        date_from,
        date_to,
        job_type: str | None = None,
    ) -> list[dict]:
        conditions = [
            'j.account_id = %s',
            'j.mode = %s',
            's.dataset = %s',
            "s.status = 'success'",
            's.period_from >= %s',
            's.period_to <= %s',
        ]
        params: list[object] = [account_id, mode, dataset, date_from, date_to]
        if job_type is not None:
            conditions.append('j.job_type = %s')
            params.append(job_type)

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                select distinct
                    s.period_from,
                    s.period_to
                from core.sync_job_steps s
                join core.sync_jobs j
                  on j.job_id = s.job_id
                where {' and '.join(conditions)}
                order by s.period_from desc, s.period_to desc
                """,
                params,
            )
            return list(cur.fetchall())

    def list_dataset_success_periods(
        self,
        account_id: UUID,
        *,
        dataset: str,
        mode: str | None = None,
        job_type: str | None = None,
    ) -> list[dict]:
        conditions = [
            'j.account_id = %s',
            's.dataset = %s',
            "s.status = 'success'",
        ]
        params: list[object] = [account_id, dataset]
        if mode is not None:
            conditions.append('j.mode = %s')
            params.append(mode)
        if job_type is not None:
            conditions.append('j.job_type = %s')
            params.append(job_type)

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                select distinct
                    s.period_from as date_from,
                    s.period_to as date_to,
                    s.finished_at
                from core.sync_job_steps s
                join core.sync_jobs j
                  on j.job_id = s.job_id
                where {' and '.join(conditions)}
                order by s.period_from asc, s.period_to asc, s.finished_at desc
                """,
                params,
            )
            return list(cur.fetchall())

    def get_dataset_coverage_bounds(
        self,
        account_id: UUID,
        *,
        dataset: str,
        mode: str | None = None,
        job_type: str | None = None,
    ) -> dict | None:
        conditions = [
            'j.account_id = %s',
            's.dataset = %s',
            "s.status = 'success'",
        ]
        params: list[object] = [account_id, dataset]
        if mode is not None:
            conditions.append('j.mode = %s')
            params.append(mode)
        if job_type is not None:
            conditions.append('j.job_type = %s')
            params.append(job_type)

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                select
                    min(s.period_from) as loaded_from,
                    max(s.period_to) as loaded_to,
                    max(s.finished_at) as last_success_at
                from core.sync_job_steps s
                join core.sync_jobs j
                  on j.job_id = s.job_id
                where {' and '.join(conditions)}
                """,
                params,
            )
            row = cur.fetchone()
        if row is None or row['loaded_from'] is None:
            return None
        return row

    def get_dataset_last_problem(
        self,
        account_id: UUID,
        *,
        dataset: str,
        mode: str | None = None,
        job_type: str | None = None,
    ) -> dict | None:
        conditions = [
            'j.account_id = %s',
            's.dataset = %s',
            "s.status = 'failed'",
        ]
        params: list[object] = [account_id, dataset]
        if mode is not None:
            conditions.append('j.mode = %s')
            params.append(mode)
        if job_type is not None:
            conditions.append('j.job_type = %s')
            params.append(job_type)

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                select
                    s.status,
                    s.error_message,
                    coalesce(s.finished_at, j.finished_at, j.created_at) as finished_at
                from core.sync_job_steps s
                join core.sync_jobs j
                  on j.job_id = s.job_id
                where {' and '.join(conditions)}
                order by coalesce(s.finished_at, j.finished_at, j.created_at) desc
                limit 1
                """,
                params,
            )
            return cur.fetchone()

    def get_operational_dataset_freshness(
        self,
        account_id: UUID,
        *,
        dataset: str,
        mode: str | None = None,
        job_type: str | None = None,
    ) -> dict | None:
        row = self.get_dataset_coverage_bounds(account_id, dataset=dataset, mode=mode, job_type=job_type)
        if row is None:
            return None
        return {
            'actual_to': row['loaded_to'],
            'last_success_at': row['last_success_at'],
        }

    def get_cards_snapshot(self, account_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    count(*)::int as entity_count,
                    max(loaded_at) as last_success_at
                from core.product_cards
                where account_id = %s
                """,
                (account_id,),
            )
            row = cur.fetchone()
        if row is None or row['entity_count'] == 0:
            return None
        return row

    def get_stocks_snapshot(self, account_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    count(*)::int as entity_count,
                    max(snapshot_loaded_at) as actual_at
                from mart.ui_stock_item_snapshot
                where account_id = %s
                """,
                (account_id,),
            )
            row = cur.fetchone()
        if row is None or row['entity_count'] == 0:
            return None
        return row

    def get_supplies_snapshot(self, account_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    count(distinct supply_id)::int as entity_count,
                    max(loaded_at) as actual_at,
                    max(loaded_at) as last_success_at
                from core.supplies
                where account_id = %s
                """,
                (account_id,),
            )
            row = cur.fetchone()
        if row is None or row['entity_count'] == 0:
            return None
        return row

    def has_successful_prepare_step_for_account(
        self,
        account_id: UUID,
        *,
        mode: str,
        dataset: str,
        job_type: str | None = None,
    ) -> bool:
        conditions = [
            'j.account_id = %s',
            'j.mode = %s',
            's.dataset = %s',
            "s.status = 'success'",
            "coalesce(s.payload_json ->> 'step_type', '') = 'prepare'",
        ]
        params: list[object] = [account_id, mode, dataset]
        if job_type is not None:
            conditions.append('j.job_type = %s')
            params.append(job_type)

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                select exists(
                    select 1
                    from core.sync_job_steps s
                    join core.sync_jobs j
                      on j.job_id = s.job_id
                    where {' and '.join(conditions)}
                ) as has_success
                """,
                params,
            )
            row = cur.fetchone()
        return bool(row['has_success']) if row is not None else False

    def recover_timed_out_running_steps(self, *, job_id: UUID | None = None) -> int:
        conditions = [
            "s.status = 'running'",
            "s.started_at is not null",
            "s.started_at <= %s",
        ]
        params: list[object] = [datetime.now(timezone.utc) - RUNNING_STEP_TIMEOUT]
        if job_id is not None:
            conditions.append('s.job_id = %s')
            params.append(job_id)

        where_sql = ' and '.join(conditions)
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                update core.sync_job_steps s
                set status = 'pending',
                    error_message = coalesce(s.error_message, 'Running step timed out and was returned to pending'),
                    next_retry_at = now(),
                    finished_at = null,
                    payload_json = coalesce(s.payload_json, '{{}}'::jsonb) || %s::jsonb
                where {where_sql}
                """,
                [json.dumps({'watchdog': {'timed_out': True, 'reason': 'running_step_timeout'}})] + params,
            )
            return cur.rowcount

    def get_next_pending_step(
        self,
        *,
        mode: str | None = None,
        dataset: str | None = None,
        job_id: UUID | None = None,
    ) -> dict | None:
        if job_id is not None:
            return self._get_next_pending_step_strict_for_job(job_id=job_id, mode=mode, dataset=dataset)

        conditions = [
            "s.status = 'pending'",
            "j.status in ('pending', 'running', 'partial_success', 'failed')",
            "(s.next_retry_at is null or s.next_retry_at <= now())",
        ]
        params: list[object] = []
        if mode is not None:
            conditions.append('j.mode = %s')
            params.append(mode)
        if dataset is not None:
            conditions.append('s.dataset = %s')
            params.append(dataset)
        if job_id is not None:
            conditions.append('s.job_id = %s')
            params.append(job_id)

        where_sql = ' and\n                  '.join(conditions)
        query = f"""
            select
                s.step_id,
                s.job_id,
                s.dataset,
                s.period_from,
                s.period_to,
                s.status,
                s.attempt,
                s.error_message,
                s.next_retry_at,
                s.payload_json,
                j.account_id,
                j.job_type,
                j.mode,
                j.status as job_status
            from core.sync_job_steps s
            join core.sync_jobs j
              on j.job_id = s.job_id
            where {where_sql}
            order by s.period_from desc, s.period_to desc, s.created_at desc, s.step_id desc
            limit 1
        """
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()

    def _get_next_pending_step_strict_for_job(
        self,
        *,
        job_id: UUID,
        mode: str | None = None,
        dataset: str | None = None,
    ) -> dict | None:
        conditions = ['s.job_id = %s']
        params: list[object] = [job_id]
        if mode is not None:
            conditions.append('j.mode = %s')
            params.append(mode)
        if dataset is not None:
            conditions.append('s.dataset = %s')
            params.append(dataset)

        where_sql = ' and\n                  '.join(conditions)
        query = f"""
            select
                s.step_id,
                s.job_id,
                s.dataset,
                s.period_from,
                s.period_to,
                s.status,
                s.attempt,
                s.error_message,
                s.next_retry_at,
                s.payload_json,
                j.account_id,
                j.job_type,
                j.mode,
                j.status as job_status
            from core.sync_job_steps s
            join core.sync_jobs j
              on j.job_id = s.job_id
            where {where_sql}
              and j.status in ('pending', 'running', 'partial_success', 'failed')
            order by s.period_from desc, s.period_to desc, s.created_at desc, s.step_id desc
        """
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            rows = list(cur.fetchall())

        rows = sorted(rows, key=self._step_sort_key)

        for row in rows:
            status = str(row['status'])
            if status == 'success':
                continue
            if status == 'running':
                return None
            if status == 'failed':
                return None
            if status == 'pending':
                next_retry_at = row['next_retry_at']
                if next_retry_at is not None and next_retry_at > datetime.now(timezone.utc):
                    return None
                return row
            return None

        return None

    def mark_job_running(self, job_id: UUID) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_jobs
                set status = 'running',
                    started_at = coalesce(started_at, now()),
                    error_message = null
                where job_id = %s
                """,
                (job_id,),
            )

    def mark_step_running(self, step_id: UUID) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'running',
                    started_at = coalesce(started_at, now()),
                    error_message = null,
                    next_retry_at = null,
                    payload_json = coalesce(payload_json, '{}'::jsonb) - 'phase' - 'phase_label'
                where step_id = %s
                """,
                (step_id,),
            )

    def mark_step_success(self, step_id: UUID) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'success',
                    finished_at = now(),
                    error_message = null,
                    next_retry_at = null
                where step_id = %s
                  and status <> 'cancelled'
                """,
                (step_id,),
            )

    def mark_step_for_retry(self, step_id: UUID, *, error_message: str, next_retry_at) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'pending',
                    attempt = attempt + 1,
                    error_message = %s,
                    next_retry_at = %s,
                    finished_at = null
                where step_id = %s
                  and status <> 'cancelled'
                """,
                (error_message, next_retry_at, step_id),
            )

    def mark_step_failed(self, step_id: UUID, *, error_message: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'failed',
                    finished_at = now(),
                    error_message = %s,
                    next_retry_at = null
                where step_id = %s
                  and status <> 'cancelled'
                """,
                (error_message, step_id),
            )

    def update_step_payload(self, step_id: UUID, payload_json: dict) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set payload_json = coalesce(payload_json, '{}'::jsonb) || %s::jsonb
                where step_id = %s
                """,
                (json.dumps(payload_json), step_id),
            )

    def get_raw_resume_state(self, *, load_id: UUID) -> dict[str, Any] | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select load_id, rows_loaded
                from raw.load_runs
                where load_id = %s
                """,
                (load_id,),
            )
            load_run = cur.fetchone()
            if load_run is None:
                return None

            cur.execute(
                """
                select payload, request_params
                from raw.api_payloads
                where load_id = %s
                order by fetched_at desc
                limit 1
                """,
                (load_id,),
            )
            payload_row = cur.fetchone()

        rows_loaded = int(load_run['rows_loaded'] or 0)
        next_rrdid = 0
        page_count = 0

        if payload_row is not None:
            payload = payload_row['payload']
            request_params = payload_row['request_params'] or {}
            if isinstance(payload, list):
                page_count = len(payload)
                next_rrdid = self._extract_next_rrdid_from_payload(payload, int(request_params.get('rrdid', 0) or 0))

        return {
            'load_id': str(load_id),
            'next_rrdid': next_rrdid,
            'rows_loaded': rows_loaded,
            'page_count': page_count,
        }

    def _extract_next_rrdid_from_payload(self, payload: list[Any], current_rrdid: int) -> int:
        if not payload:
            return current_rrdid

        last_item = payload[-1]
        if not isinstance(last_item, dict):
            return current_rrdid

        for key in ('rrd_id', 'rrdid', 'rrdId'):
            if key in last_item:
                value = last_item[key]
                try:
                    return int(value)
                except (TypeError, ValueError):
                    return current_rrdid

        return current_rrdid

    def reset_failed_steps(self, job_id: UUID) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'pending',
                    attempt = 1,
                    error_message = null,
                    next_retry_at = null,
                    started_at = null,
                    finished_at = null
                where job_id = %s
                  and status = 'failed'
                """,
                (job_id,),
            )
            return cur.rowcount

    def refresh_job_status(self, job_id: UUID) -> str:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    count(*)::int as total_steps,
                    count(*) filter (where status = 'success')::int as success_steps,
                    count(*) filter (where status = 'failed')::int as failed_steps,
                    count(*) filter (where status = 'pending')::int as pending_steps,
                    count(*) filter (where status = 'running')::int as running_steps
                from core.sync_job_steps
                where job_id = %s
                """,
                (job_id,),
            )
            counts = cur.fetchone()

            total_steps = counts['total_steps']
            success_steps = counts['success_steps']
            failed_steps = counts['failed_steps']
            pending_steps = counts['pending_steps']
            running_steps = counts['running_steps']

            cur.execute('select status from core.sync_jobs where job_id = %s', (job_id,))
            current_job_row = cur.fetchone()
            current_job_status = current_job_row['status'] if current_job_row is not None else None

            if current_job_status == 'cancelled':
                return 'cancelled'
            if total_steps == 0:
                status = 'pending'
            elif running_steps > 0:
                status = 'running'
            elif failed_steps > 0 and success_steps > 0:
                status = 'partial_success'
            elif failed_steps > 0:
                status = 'failed'
            elif pending_steps > 0:
                status = 'running'
            else:
                status = 'success'

            if status in ('success', 'partial_success', 'failed'):
                cur.execute(
                    """
                    update core.sync_jobs
                    set status = %s,
                        finished_at = now(),
                        error_message = case when %s in ('partial_success', 'failed') then coalesce(error_message, 'Some steps failed') else null end
                    where job_id = %s
                    """,
                    (status, status, job_id),
                )
            else:
                cur.execute(
                    """
                    update core.sync_jobs
                    set status = %s,
                        finished_at = null
                    where job_id = %s
                    """,
                    (status, job_id),
                )

            return status

    def _account_lock_key(self, account_id: UUID, *, mode: str, dataset: str) -> int:
        digest = hashlib.sha256(f'{account_id}:{mode}:{dataset}'.encode('utf-8')).digest()
        return int.from_bytes(digest[:8], byteorder='big', signed=False) & ((1 << 63) - 1)

    def _job_lock_key(self, job_id: UUID) -> int:
        digest = hashlib.sha256(str(job_id).encode('utf-8')).digest()
        return int.from_bytes(digest[:8], byteorder='big', signed=False) & ((1 << 63) - 1)


    def _step_sort_key(self, row: dict) -> tuple:
        payload = row.get('payload_json') or {}
        step_type = payload.get('step_type') if isinstance(payload, dict) else None
        step_type_rank = {
            'prepare': 0,
            'snapshot': 1,
            'weekly_dataset': 2,
            'open_week_dataset': 2,
            'finalize': 3,
        }.get(step_type, 2)
        dataset_rank = {
            'cards': 0,
            'adverts_snapshot': 1,
            'sales': 2,
            'sales_funnel': 3,
            'adverts_cost': 4,
            'acceptance': 5,
            'storage': 6,
            'warehouse_remains': 7,
        }.get(str(row.get('dataset')), 99)

        period_from = row.get('period_from')
        period_to = row.get('period_to')
        if step_type_rank == 1 and period_from is not None and period_to is not None:
            return (step_type_rank, -period_from.toordinal(), -period_to.toordinal(), dataset_rank)

        return (step_type_rank, dataset_rank, 0, 0)
