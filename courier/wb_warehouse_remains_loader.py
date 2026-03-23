import argparse
import sys
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_snapshot
from courier.raw_read import fetch_latest_single_payload


SOURCE = "warehouseRemains"
IN_TRANSIT_TO_CUSTOMER = "В пути до получателей"
IN_TRANSIT_FROM_CUSTOMER = "В пути возвраты на склад WB"
TOTAL_ON_WAREHOUSES = "Всего находится на складах"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries warehouse remains from raw into core tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
) -> tuple[list[tuple], list[tuple]]:
    item_rows: list[tuple] = []
    balance_rows: list[tuple] = []

    for item in payload:
        nm_id = item.get("nmId")
        barcode = item.get("barcode")
        tech_size = item.get("techSize")
        if nm_id is None or barcode is None:
            continue

        in_transit_to_customer = None
        in_transit_from_customer = None
        total_on_warehouses = None

        warehouses = item.get("warehouses") or []
        for warehouse in warehouses:
            warehouse_name = warehouse.get("warehouseName")
            quantity = decimal_or_none(warehouse.get("quantity"))
            if not warehouse_name:
                continue
            balance_rows.append(
                (
                    account_id,
                    int(nm_id),
                    item.get("vendorCode"),
                    str(barcode),
                    str(tech_size or ""),
                    warehouse_name,
                    quantity,
                    load_id,
                )
            )
            if warehouse_name == IN_TRANSIT_TO_CUSTOMER:
                in_transit_to_customer = quantity
            elif warehouse_name == IN_TRANSIT_FROM_CUSTOMER:
                in_transit_from_customer = quantity
            elif warehouse_name == TOTAL_ON_WAREHOUSES:
                total_on_warehouses = quantity

        item_rows.append(
            (
                account_id,
                int(nm_id),
                item.get("vendorCode"),
                item.get("brand"),
                item.get("subjectName"),
                str(barcode),
                str(tech_size or ""),
                decimal_or_none(item.get("volume")),
                in_transit_to_customer,
                in_transit_from_customer,
                total_on_warehouses,
                load_id,
            )
        )

    return item_rows, balance_rows


def insert_rows(
    conn: psycopg.Connection,
    item_rows: list[tuple],
    balance_rows: list[tuple],
) -> None:
    with conn.cursor() as cur:
        if item_rows:
            cur.executemany(
                """
                insert into core.warehouse_remains_items (
                    account_id,
                    nm_id,
                    vendor_code,
                    brand,
                    subject_name,
                    barcode,
                    tech_size,
                    volume,
                    in_transit_to_customer,
                    in_transit_from_customer,
                    total_on_warehouses,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                """,
                item_rows,
            )
        if balance_rows:
            cur.executemany(
                """
                insert into core.warehouse_remains_balances (
                    account_id,
                    nm_id,
                    vendor_code,
                    barcode,
                    tech_size,
                    warehouse_name,
                    quantity,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, now())
                """,
                balance_rows,
            )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(conn, account_id=account_id, source=SOURCE)
        if not isinstance(payload, list):
            raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
        item_rows, balance_rows = build_rows(account_id, load_id, payload)
        replace_account_snapshot(
            conn,
            account_id=account_id,
            table_names=("core.warehouse_remains_balances", "core.warehouse_remains_items"),
        )
        insert_rows(conn, item_rows, balance_rows)
        return CoreLoadResult(
            source=SOURCE,
            load_id=str(load_id),
            metrics={"items": len(item_rows), "balances": len(balance_rows)},
        )

    return run_core_load(load)


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
