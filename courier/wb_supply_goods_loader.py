import argparse
import sys
import uuid
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_snapshot
from courier.raw_read import fetch_latest_payload_rows


SOURCE = "supplyGoods"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries supply goods from raw into core.supply_goods."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def bool_or_none(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    return bool(value)


def build_rows(account_id: uuid.UUID, load_id: uuid.UUID, payload_rows: list[tuple[object, dict]]) -> list[tuple]:
    rows: list[tuple] = []
    for payload, request_params in payload_rows:
        if not isinstance(payload, list):
            continue
        target_id = int(request_params["target_id"])
        is_preorder_id = bool(request_params["is_preorder_id"])
        for item in payload:
            nm_id = item.get("nmID")
            barcode = item.get("barcode")
            tech_size = item.get("techSize")
            if nm_id is None or barcode is None or tech_size is None:
                continue
            rows.append(
                (
                    account_id,
                    target_id,
                    is_preorder_id,
                    str(barcode),
                    item.get("vendorCode"),
                    int(nm_id),
                    bool_or_none(item.get("needKiz")),
                    item.get("tnved"),
                    str(tech_size),
                    item.get("color"),
                    int_or_none(item.get("supplierBoxAmount")),
                    int_or_none(item.get("quantity")),
                    int_or_none(item.get("readyForSaleQuantity")),
                    int_or_none(item.get("unloadingQuantity")),
                    int_or_none(item.get("acceptedQuantity")),
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
            insert into core.supply_goods (
                account_id, supply_target_id, is_preorder_id, barcode, vendor_code,
                nm_id, need_kiz, tnved, tech_size, color, supplier_box_amount,
                quantity, ready_for_sale_quantity, unloading_quantity, accepted_quantity,
                raw_load_id, loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            """,
            rows,
        )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload_rows = fetch_latest_payload_rows(conn, account_id=account_id, source=SOURCE)
        rows = build_rows(account_id, load_id, payload_rows)
        replace_account_snapshot(conn, account_id=account_id, table_names=("core.supply_goods",))
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
