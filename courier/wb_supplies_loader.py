import argparse
import sys
import uuid
from datetime import datetime
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_snapshot
from courier.raw_read import fetch_latest_payload_pages


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


def build_rows(account_id: uuid.UUID, load_id: uuid.UUID, payload_pages: list[list[dict[str, Any]]]) -> list[tuple]:
    rows: list[tuple] = []
    seen_preorders: set[int] = set()
    for page in payload_pages:
        if not isinstance(page, list):
            continue
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

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload_pages = fetch_latest_payload_pages(conn, account_id=account_id, source=SOURCE)
        rows = build_rows(account_id, load_id, payload_pages)
        replace_account_snapshot(conn, account_id=account_id, table_names=("core.supplies",))
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
