import argparse
import sys
import uuid
from datetime import datetime
from typing import Any

import psycopg

from courier.common import db_connection


SOURCE = "supplies"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries supplies list from raw into core.supplies."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def parse_dt_or_none(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def get_latest_payload_pages(conn: psycopg.Connection, account_id: uuid.UUID) -> tuple[uuid.UUID, list[list[dict[str, Any]]]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select load_id
            from raw.load_runs
            where account_id = %s and source = %s and status = 'success'
            order by fetched_at desc
            limit 1
            """,
            (account_id, SOURCE),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("No successful raw supplies load found for the account")
        load_id = row[0]
        cur.execute(
            """
            select payload
            from raw.api_payloads
            where load_id = %s
            order by fetched_at, id
            """,
            (load_id,),
        )
        payload_rows = cur.fetchall()
    return load_id, [item[0] for item in payload_rows]


def replace_snapshot(conn: psycopg.Connection, account_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        cur.execute("delete from core.supplies where account_id = %s", (account_id,))


def build_rows(account_id: uuid.UUID, load_id: uuid.UUID, payload_pages: list[list[dict[str, Any]]]) -> list[tuple]:
    rows: list[tuple] = []
    seen_preorders: set[int] = set()
    for page in payload_pages:
        for item in page:
            preorder_id = item.get("preorderID")
            if preorder_id is None:
                continue
            preorder_id = int(preorder_id)
            if preorder_id in seen_preorders:
                continue
            seen_preorders.add(preorder_id)
            rows.append(
                (
                    account_id,
                    int_or_none(item.get("supplyID")),
                    preorder_id,
                    parse_dt_or_none(item.get("createDate")),
                    parse_dt_or_none(item.get("supplyDate")),
                    parse_dt_or_none(item.get("factDate")),
                    parse_dt_or_none(item.get("updatedDate")),
                    int_or_none(item.get("statusID")),
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
            insert into core.supplies (
                account_id, supply_id, preorder_id, create_date, supply_date,
                fact_date, updated_date, status_id, raw_load_id, loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            """,
            rows,
        )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    with db_connection() as conn:
        load_id, payload_pages = get_latest_payload_pages(conn, account_id)
        rows = build_rows(account_id, load_id, payload_pages)
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
