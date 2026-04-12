from __future__ import annotations

import argparse
import runpy
import sys
import uuid
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import get_db_connection
from courier.wb_adv_upd_loader import reload_period_from_raw


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reload all historical advUpd periods from raw into core.advert_costs."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument(
        "--date-from",
        help="Optional lower bound for period_from in YYYY-MM-DD",
    )
    parser.add_argument(
        "--date-to",
        help="Optional upper bound for period_to in YYYY-MM-DD",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Optional limit of periods to reload, oldest first.",
    )
    parser.add_argument(
        "--refresh-marts",
        action="store_true",
        help="Run scripts/refresh_marts.py after successful reload.",
    )
    return parser.parse_args()


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def load_periods(
    account_id: uuid.UUID,
    *,
    date_from: date | None,
    date_to: date | None,
    limit: int | None,
) -> list[tuple[date, date]]:
    conn = get_db_connection()
    try:
        clauses = [
            "account_id = %s",
            "source = 'advUpd'",
            "status = 'success'",
            "period_mode = 'range'",
        ]
        params: list[object] = [account_id]
        if date_from is not None:
            clauses.append("period_from >= %s")
            params.append(date_from)
        if date_to is not None:
            clauses.append("period_to <= %s")
            params.append(date_to)

        limit_sql = ""
        if limit is not None:
            limit_sql = "limit %s"
            params.append(limit)

        with conn.cursor() as cur:
            cur.execute(
                f"""
                select period_from, period_to
                from (
                    select distinct on (period_from, period_to)
                        period_from,
                        period_to,
                        fetched_at
                    from raw.load_runs
                    where {' and '.join(clauses)}
                    order by period_from, period_to, fetched_at desc
                ) runs
                order by period_from, period_to
                {limit_sql}
                """,
                tuple(params),
            )
            rows = cur.fetchall()
        return [(row["period_from"], row["period_to"]) for row in rows]
    finally:
        conn.close()


def refresh_marts() -> None:
    runpy.run_path(str(ROOT / "scripts" / "refresh_marts.py"), run_name="__main__")


def main() -> None:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    date_from = parse_date(args.date_from)
    date_to = parse_date(args.date_to)
    periods = load_periods(
        account_id,
        date_from=date_from,
        date_to=date_to,
        limit=args.limit,
    )
    if not periods:
        print("No successful advUpd raw periods found.")
        return

    print(f"Reloading {len(periods)} advUpd periods for account {account_id}...")
    conn = get_db_connection()
    try:
        total_rows = 0
        for period_from, period_to in periods:
            result = reload_period_from_raw(
                conn,
                account_id=account_id,
                date_from=period_from,
                date_to=period_to,
            )
            conn.commit()
            rows_loaded = int(result.metrics.get("rows_loaded", 0))
            total_rows += rows_loaded
            print(f"{period_from} .. {period_to}: {rows_loaded} rows")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Reloaded {len(periods)} periods, total rows: {total_rows}")
    if args.refresh_marts:
        print("Refreshing marts...")
        refresh_marts()
        print("Marts refreshed.")


if __name__ == "__main__":
    main()
