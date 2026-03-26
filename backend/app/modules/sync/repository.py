import json
from uuid import UUID

import psycopg


class SyncRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

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
                    started_at,
                    finished_at
                from core.sync_job_steps
                where job_id = %s
                order by period_from, period_to, created_at, step_id
                """,
                (job_id,),
            )
            return list(cur.fetchall())

    def get_next_pending_step(
        self,
        *,
        mode: str | None = None,
        dataset: str | None = None,
        job_id: UUID | None = None,
    ) -> dict | None:
        conditions = [
            "s.status = 'pending'",
            "j.status in ('pending', 'running')",
        ]
        params: list[object] = []
        if mode is not None:
            conditions.append("j.mode = %s")
            params.append(mode)
        if dataset is not None:
            conditions.append("s.dataset = %s")
            params.append(dataset)
        if job_id is not None:
            conditions.append("s.job_id = %s")
            params.append(job_id)

        where_sql = " and\n                  ".join(conditions)
        query = f"""
            select
                s.step_id,
                s.job_id,
                s.dataset,
                s.period_from,
                s.period_to,
                s.status,
                s.attempt,
                s.payload_json,
                j.account_id,
                j.job_type,
                j.mode,
                j.status as job_status
            from core.sync_job_steps s
            join core.sync_jobs j
              on j.job_id = s.job_id
            where {where_sql}
            order by s.period_from, s.period_to, s.created_at, s.step_id
            limit 1
        """
        with self._conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()

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
                    error_message = null
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
                    error_message = null
                where step_id = %s
                """,
                (step_id,),
            )

    def mark_step_failed(self, step_id: UUID, *, error_message: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.sync_job_steps
                set status = 'failed',
                    finished_at = now(),
                    error_message = %s
                where step_id = %s
                """,
                (error_message, step_id),
            )

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

            if total_steps == 0:
                status = 'pending'
            elif pending_steps > 0 or running_steps > 0:
                status = 'running'
            elif failed_steps > 0 and success_steps > 0:
                status = 'partial_success'
            elif failed_steps > 0:
                status = 'failed'
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
