import argparse
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import db_connection, parse_iso_date


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


def get_latest_payload(
    conn: psycopg.Connection,
    account_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> tuple[uuid.UUID, list[dict[str, Any]]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select lr.load_id, ap.payload
            from raw.load_runs lr
            join raw.api_payloads ap on ap.load_id = lr.load_id
            where lr.account_id = %s
              and lr.source = %s
              and lr.status = 'success'
              and lr.period_from = %s
              and lr.period_to = %s
              and lr.period_mode = 'range'
            order by lr.fetched_at desc, ap.id desc
            limit 1
            """,
            (account_id, SOURCE, date_from, date_to),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("No successful raw advUpd load found for the requested period")
    return row[0], row[1]


def replace_period(
    conn: psycopg.Connection,
    account_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            delete from core.advert_costs
            where account_id = %s
              and upd_time is not null
              and upd_time::date between %s and %s
            """,
            (account_id, date_from, date_to),
        )


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
    date_from: date,
    date_to: date,
) -> list[tuple]:
    rows: list[tuple] = []
    for item in payload:
        advert_id = item.get("advertId")
        upd_num = item.get("updNum")
        if advert_id is None or upd_num is None:
            continue
        rows.append(
            (
                account_id,
                int(advert_id),
                int(upd_num),
                parse_upd_time(item.get("updTime")),
                decimal_or_none(item.get("updSum")),
                date_from,
                date_to,
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

    with db_connection() as conn:
        load_id, payload = get_latest_payload(conn, account_id, date_from, date_to)
        rows = build_rows(account_id, load_id, payload, date_from, date_to)
        replace_period(conn, account_id, date_from, date_to)
        insert_rows(conn, rows)
        conn.commit()

    print(f"source={SOURCE} load_id={load_id} rows_loaded={len(rows)}")
    return 0


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

