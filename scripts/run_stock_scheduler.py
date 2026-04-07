import argparse
import sys
from datetime import datetime, timedelta, timezone, date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import get_db_connection
from backend.app.modules.sync.service import SyncService
from backend.app.modules.sync.schemas import SyncDataset, SyncJobCreate, SyncJobType, SyncMode

DATASET = SyncDataset.WAREHOUSE_REMAINS.value
BACKOFF_MINUTES = 5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Schedule stock snapshot refresh jobs for due accounts.')
    parser.add_argument('--limit', type=int, default=100, help='Maximum number of due schedules to process in one run.')
    parser.add_argument('--plan-only', action='store_true', help='Only create due jobs without executing them.')
    return parser.parse_args()


def sync_schedule_state(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            update core.sync_account_schedules s
            set last_success_at = j.finished_at,
                last_error_at = null,
                next_run_at = coalesce(s.next_run_at, now()),
                updated_at = now()
            from core.sync_jobs j
            where s.last_job_id = j.job_id
              and s.dataset = %s
              and j.status = 'success'
              and (s.last_success_at is null or j.finished_at > s.last_success_at)
            """,
            (DATASET,),
        )
        cur.execute(
            """
            update core.sync_account_schedules s
            set last_error_at = coalesce(j.finished_at, now()),
                updated_at = now()
            from core.sync_jobs j
            where s.last_job_id = j.job_id
              and s.dataset = %s
              and j.status in ('failed', 'partial_success', 'cancelled')
              and (s.last_error_at is null or coalesce(j.finished_at, now()) > s.last_error_at)
            """,
            (DATASET,),
        )


def fetch_due_schedules(conn, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select schedule_id, account_id, dataset, interval_minutes, next_run_at, last_job_id
            from core.sync_account_schedules
            where dataset = %s
              and enabled = true
              and coalesce(next_run_at, now()) <= now()
            order by coalesce(next_run_at, now()) asc, created_at asc
            limit %s
            """,
            (DATASET, limit),
        )
        return list(cur.fetchall())


def main() -> int:
    args = parse_args()
    created = 0
    skipped_active = 0
    executed = 0
    executed_existing = 0
    now = datetime.now(timezone.utc)
    today_iso = date.today().isoformat()

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            schema_sql = (ROOT / 'db' / 'core' / 'sync_account_schedules.sql').read_text(encoding='utf-8')
            cur.execute(schema_sql)
        sync_schedule_state(conn)
        conn.commit()

        due_rows = fetch_due_schedules(conn, args.limit)
        due_count = len(due_rows)

        for row in due_rows:
            service = SyncService(conn)
            active_job = service._repository.get_active_job_for_account(  # noqa: SLF001
                row['account_id'],
                mode=SyncMode.DAILY.value,
                dataset=DATASET,
            )
            if active_job is not None:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        update core.sync_account_schedules
                        set last_job_id = %s,
                            next_run_at = now() + make_interval(mins => %s),
                            updated_at = now()
                        where schedule_id = %s
                        """,
                        (active_job['job_id'], BACKOFF_MINUTES, row['schedule_id']),
                    )
                conn.commit()
                skipped_active += 1
                if not args.plan_only:
                    from backend.app.modules.sync.executor import SyncExecutor
                    SyncExecutor().execute_job_until_done(
                        job_id=active_job['job_id'],
                        dataset=DATASET,
                    )
                    sync_schedule_state(conn)
                    conn.commit()
                    executed_existing += 1
                continue

            payload = SyncJobCreate(
                account_id=row['account_id'],
                job_type=SyncJobType.STOCK_SNAPSHOT_REFRESH,
                mode=SyncMode.DAILY,
                date_from=date.fromisoformat(today_iso),
                date_to=date.fromisoformat(today_iso),
                datasets=[SyncDataset.WAREHOUSE_REMAINS],
            )
            response = service.create_job(payload)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update core.sync_account_schedules
                    set last_job_id = %s,
                        next_run_at = now() + make_interval(mins => %s),
                        updated_at = now()
                    where schedule_id = %s
                    """,
                    (response.job_id, row['interval_minutes'], row['schedule_id']),
                )
            conn.commit()
            created += 1

            if not args.plan_only:
                from backend.app.modules.sync.executor import SyncExecutor
                SyncExecutor().execute_job_until_done(
                    job_id=response.job_id,
                    dataset=DATASET,
                )
                sync_schedule_state(conn)
                conn.commit()
                executed += 1

    print(
        'stock_scheduler '
        f'due={due_count} '
        f'created={created} skipped_active={skipped_active} executed_existing={executed_existing} '
        f'executed={executed} checked_at={now.isoformat()}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
