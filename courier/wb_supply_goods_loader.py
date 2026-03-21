import argparse
import sys
import uuid
from typing import Any

import psycopg

from courier.common import db_connection


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


def get_latest_payload_pages(conn: psycopg.Connection, account_id: uuid.UUID) -> tuple[uuid.UUID, list[tuple[list[dict[str, Any]], dict[str, Any]]]]:
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
            raise RuntimeError("No successful raw supplyGoods load found for the account")
        load_id = row[0]
        cur.execute(
            """
            select payload, request_params
            from raw.api_payloads
            where load_id = %s
            order by fetched_at, id
            """,
            (load_id,),
        )
        payload_rows = cur.fetchall()
    return load_id, [(item[0], item[1]) for item in payload_rows]


def replace_snapshot(conn: psycopg.Connection, account_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        cur.execute("delete from core.supply_goods where account_id = %s", (account_id,))


def build_rows(account_id: uuid.UUID, load_id: uuid.UUID, payload_pages: list[tuple[list[dict[str, Any]], dict[str, Any]]]) -> list[tuple]:
    rows: list[tuple] = []
    for payload, request_params in payload_pages:
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
