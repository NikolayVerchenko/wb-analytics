import argparse
import sys
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import db_connection


SOURCE = "wbOffices"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries offices from raw into core.wb_offices."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def get_latest_payload(conn: psycopg.Connection, account_id: uuid.UUID) -> tuple[uuid.UUID, list[dict[str, Any]]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select lr.load_id, ap.payload
            from raw.load_runs lr
            join raw.api_payloads ap on ap.load_id = lr.load_id
            where lr.account_id = %s
              and lr.source = %s
              and lr.status = 'success'
            order by lr.fetched_at desc, ap.id desc
            limit 1
            """,
            (account_id, SOURCE),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("No successful raw wbOffices load found for the account")
    return row[0], row[1]


def replace_snapshot(conn: psycopg.Connection, account_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        cur.execute("delete from core.wb_offices where account_id = %s", (account_id,))


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
) -> list[tuple]:
    rows: list[tuple] = []
    for item in payload:
        office_id = item.get("id")
        if office_id is None:
            continue
        rows.append(
            (
                account_id,
                int(office_id),
                item.get("name"),
                item.get("city"),
                item.get("address"),
                decimal_or_none(item.get("longitude")),
                decimal_or_none(item.get("latitude")),
                int_or_none(item.get("cargoType")),
                int_or_none(item.get("deliveryType")),
                item.get("federalDistrict"),
                item.get("selected"),
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
            insert into core.wb_offices (
                account_id,
                office_id,
                name,
                city,
                address,
                longitude,
                latitude,
                cargo_type,
                delivery_type,
                federal_district,
                selected,
                raw_load_id,
                loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            """,
            rows,
        )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    with db_connection() as conn:
        load_id, payload = get_latest_payload(conn, account_id)
        rows = build_rows(account_id, load_id, payload)
        replace_snapshot(conn, account_id)
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
