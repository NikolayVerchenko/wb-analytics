import argparse
import subprocess
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import get_db_connection
from backend.app.modules.sync.repository import SyncRepository


REFRESH_MARTS = ROOT / 'scripts' / 'refresh_marts.py'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run pending sync job steps for the MVP weekly sales backfill.'
    )
    parser.add_argument('--max-steps', type=int, default=1, help='Maximum number of steps to process in one run. Use 0 for all pending steps.')
    parser.add_argument('--job-id', type=UUID, default=None, help='Optional job_id filter for targeted execution.')
    return parser.parse_args()


def run_command(command: list[str]) -> None:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.stdout:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, file=sys.stderr, end='')
    if result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(command)}")


def process_sales_weekly_step(step: dict) -> None:
    account_id = str(step['account_id'])
    period_from = step['period_from'].isoformat()
    period_to = step['period_to'].isoformat()
    python_executable = sys.executable

    run_command([
        python_executable,
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
    ])
    run_command([
        python_executable,
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
    ])
    run_command([
        python_executable,
        str(REFRESH_MARTS),
    ])


def main() -> int:
    args = parse_args()
    processed = 0

    while True:
        if args.max_steps and processed >= args.max_steps:
            break

        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            step = repository.get_next_pending_step(mode='weekly', dataset='sales', job_id=args.job_id)
            if step is None:
                break

            step_id = UUID(str(step['step_id']))
            job_id = UUID(str(step['job_id']))
            repository.mark_job_running(job_id)
            repository.mark_step_running(step_id)
            conn.commit()

        try:
            process_sales_weekly_step(step)
        except Exception as exc:
            with get_db_connection() as conn:
                repository = SyncRepository(conn)
                repository.mark_step_failed(step_id, error_message=str(exc)[:4000])
                repository.refresh_job_status(job_id)
                conn.commit()
            print(f'step_id={step_id} status=failed error={exc}', file=sys.stderr)
        else:
            with get_db_connection() as conn:
                repository = SyncRepository(conn)
                repository.mark_step_success(step_id)
                repository.refresh_job_status(job_id)
                conn.commit()
            print(f'step_id={step_id} status=success')

        processed += 1

    print(f'processed_steps={processed}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
