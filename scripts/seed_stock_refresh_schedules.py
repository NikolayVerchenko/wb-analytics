import argparse
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from courier.common import db_connection

DATASET = 'warehouse_remains'
DEFAULT_INTERVAL = 15


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Seed stock snapshot schedules for accounts.')
    parser.add_argument('--account-id', action='append', dest='account_ids', default=[], help='Optional account UUID. Repeat to target several accounts.')
    parser.add_argument('--disable', action='store_true', help='Create disabled schedules instead of enabled ones.')
    parser.add_argument('--interval-minutes', type=int, default=DEFAULT_INTERVAL, help='Refresh interval in minutes.')
    return parser.parse_args()


def fetch_account_ids(conn, account_ids: list[str]) -> list[str]:
    with conn.cursor() as cur:
        if account_ids:
            cur.execute(
                'select account_id::text from core.accounts where account_id = any(%s::uuid[]) order by account_id',
                (account_ids,),
            )
        else:
            cur.execute('select account_id::text from core.accounts order by account_id')
        return [row[0] for row in cur.fetchall()]


def main() -> int:
    args = parse_args()
    if args.interval_minutes <= 0:
        raise SystemExit('interval_minutes must be > 0')

    with db_connection() as conn:
        with conn.cursor() as cur:
            schema_sql = (ROOT / 'db' / 'core' / 'sync_account_schedules.sql').read_text(encoding='utf-8')
            cur.execute(schema_sql)
            account_ids = fetch_account_ids(conn, args.account_ids)
            inserted = 0
            updated = 0
            for account_id in account_ids:
                cur.execute(
                    """
                    insert into core.sync_account_schedules (
                        schedule_id,
                        account_id,
                        dataset,
                        enabled,
                        interval_minutes,
                        next_run_at,
                        created_at,
                        updated_at
                    )
                    values (%s, %s::uuid, %s, %s, %s, now(), now(), now())
                    on conflict (account_id, dataset) do update
                    set enabled = excluded.enabled,
                        interval_minutes = excluded.interval_minutes,
                        updated_at = now()
                    returning (xmax = 0) as inserted
                    """,
                    (str(uuid4()), account_id, DATASET, not args.disable, args.interval_minutes),
                )
                row = cur.fetchone()
                if row and row[0]:
                    inserted += 1
                else:
                    updated += 1
        conn.commit()

    print(f'dataset={DATASET} inserted={inserted} updated={updated} enabled={not args.disable} interval_minutes={args.interval_minutes}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
