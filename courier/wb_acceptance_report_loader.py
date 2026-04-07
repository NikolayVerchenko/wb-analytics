import argparse
import sys
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.common import parse_iso_date
from courier.core_replace import replace_account_period_by_date_expression
from courier.raw_read import fetch_latest_single_payload


SOURCE = "acceptanceReport"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries acceptance report from raw into core.acceptance_costs."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def parse_date_or_none(value: Any) -> date | None:
    if value is None or value == "":
        return None
    return date.fromisoformat(str(value))


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
) -> list[tuple]:
    rows: list[tuple] = []
    for item in payload:
        nm_id = item.get("nmID")
        if nm_id is None:
            continue
        rows.append(
            (
                account_id,
                int(nm_id),
                int_or_none(item.get("incomeId")),
                int_or_none(item.get("count")),
                parse_date_or_none(item.get("giCreateDate")),
                parse_date_or_none(item.get("shkCreateDate")),
                item.get("subjectName"),
                decimal_or_none(item.get("total")),
                load_id,
            )
        )
    return rows


def insert_rows(conn: psycopg.Connection, rows: list[tuple]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into core.acceptance_costs (
                account_id,
                nm_id,
                income_id,
                item_count,
                gi_create_date,
                shk_create_date,
                subject_name,
                total_cost,
                raw_load_id,
                loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (account_id, nm_id, income_id, gi_create_date, shk_create_date)
            do update set
                item_count = excluded.item_count,
                subject_name = excluded.subject_name,
                total_cost = excluded.total_cost,
                raw_load_id = excluded.raw_load_id,
                loaded_at = now()
            """,
            rows,
        )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    date_from = parse_iso_date(args.date_from)
    date_to = parse_iso_date(args.date_to)
    if date_from > date_to:
        raise ValueError('date-from must be <= date-to')

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(conn, account_id=account_id, source=SOURCE, period_from=date_from, period_to=date_to, period_mode='range')
        if not isinstance(payload, list):
            raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
        rows = build_rows(account_id, load_id, payload)
        replace_account_period_by_date_expression(
            conn,
            table_name='core.acceptance_costs',
            date_expression='coalesce(shk_create_date, gi_create_date)',
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
        )
        insert_rows(conn, rows)
        return CoreLoadResult(source=SOURCE, load_id=str(load_id), metrics={"rows_loaded": len(rows)})

    return run_core_load(load)


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
