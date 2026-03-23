import argparse
import sys
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_snapshot
from courier.raw_read import fetch_latest_single_payload


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

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(conn, account_id=account_id, source=SOURCE)
        if not isinstance(payload, list):
            raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
        rows = build_rows(account_id, load_id, payload)
        replace_account_snapshot(conn, account_id=account_id, table_names=("core.wb_offices",))
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
