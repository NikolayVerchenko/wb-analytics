import argparse
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import parse_iso_date
from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_period_by_date_expression
from courier.raw_read import fetch_latest_single_payload


SOURCE = "advUpd"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries advertising costs from raw into core.advert_costs."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def parse_upd_time(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    normalized = str(value).replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
    date_from: date,
    date_to: date,
) -> list[tuple]:
    rows_by_key: dict[tuple[int, int], tuple] = {}
    for item in payload:
        advert_id = item.get("advertId")
        upd_num = item.get("updNum")
        if advert_id is None or upd_num is None:
            continue
        key = (int(advert_id), int(upd_num))
        rows_by_key[key] = (
            account_id,
            key[0],
            key[1],
            parse_upd_time(item.get("updTime")),
            decimal_or_none(item.get("updSum")),
            date_from,
            date_to,
            load_id,
        )
    return list(rows_by_key.values())


def insert_rows(conn: psycopg.Connection, rows: list[tuple]) -> None:
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into core.advert_costs (
                account_id,
                advert_id,
                upd_num,
                upd_time,
                upd_sum,
                period_from,
                period_to,
                raw_load_id,
                loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (account_id, advert_id, upd_num)
            do update set
                upd_time = excluded.upd_time,
                upd_sum = excluded.upd_sum,
                period_from = excluded.period_from,
                period_to = excluded.period_to,
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
        raise ValueError("date-from must be <= date-to")

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(
            conn,
            account_id=account_id,
            source=SOURCE,
            period_from=date_from,
            period_to=date_to,
            period_mode="range",
        )
        if not isinstance(payload, list):
            raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
        rows = build_rows(account_id, load_id, payload, date_from, date_to)
        replace_account_period_by_date_expression(
            conn,
            table_name="core.advert_costs",
            date_expression="upd_time::date",
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
