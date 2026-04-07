import argparse
from uuid import UUID

from backend.app.modules.sync.executor import SyncExecutor


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run pending sync job steps for the MVP weekly sales backfill.'
    )
    parser.add_argument('--max-steps', type=int, default=1, help='Maximum number of steps to process in one run. Use 0 for all pending steps.')
    parser.add_argument('--job-id', type=UUID, default=None, help='Optional job_id filter for targeted execution.')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    processed = 0
    executor = SyncExecutor()

    while True:
        if args.max_steps and processed >= args.max_steps:
            break

        executed = executor.execute_next_pending_step(mode='weekly', dataset='sales', job_id=args.job_id)
        if not executed:
            break

        processed += 1

    print(f'processed_steps={processed}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
