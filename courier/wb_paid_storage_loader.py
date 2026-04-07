import argparse
import sys
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import parse_iso_date
from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_period_by_date_column
from courier.raw_read import fetch_latest_single_payload


SOURCE = "paidStorage"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries paid storage report from raw into core.paid_storage_costs."
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
    return date.fromisoformat(str(value)[:10])


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: list[dict[str, Any]],
) -> list[tuple]:
    aggregated: dict[tuple[Any, ...], dict[str, Any]] = {}
    for item in payload:
        nm_id = item.get("nmId")
        report_date = parse_date_or_none(item.get("date"))
        if nm_id is None or report_date is None:
            continue

        nm_id_int = int(nm_id)
        vendor_code = item.get("vendorCode")
        size = item.get("size")
        office_id = int_or_none(item.get("officeId"))
        chrt_id = int_or_none(item.get("chrtId"))
        key = (
            account_id,
            report_date,
            nm_id_int,
            vendor_code,
            size,
            office_id,
            chrt_id,
        )
        warehouse_price = decimal_or_none(item.get("warehousePrice")) or Decimal("0")
        row = aggregated.get(key)
        if row is None:
            aggregated[key] = {
                "warehouse_price": warehouse_price,
                "warehouse": item.get("warehouse"),
                "barcode": item.get("barcode"),
                "subject": item.get("subject"),
                "brand": item.get("brand"),
            }
            continue

        row["warehouse_price"] += warehouse_price
        if not row["warehouse"] and item.get("warehouse"):
            row["warehouse"] = item.get("warehouse")
        if not row["barcode"] and item.get("barcode"):
            row["barcode"] = item.get("barcode")
        if not row["subject"] and item.get("subject"):
            row["subject"] = item.get("subject")
        if not row["brand"] and item.get("brand"):
            row["brand"] = item.get("brand")

    rows: list[tuple] = []
    for key, row in aggregated.items():
        (
            account_id_value,
            report_date,
            nm_id_int,
            vendor_code,
            size,
            office_id,
            chrt_id,
        ) = key
        rows.append(
            (
                account_id_value,
                report_date,
                nm_id_int,
                vendor_code,
                size,
                row["warehouse_price"],
                row["warehouse"],
                office_id,
                row["barcode"],
                row["subject"],
                row["brand"],
                chrt_id,
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
            insert into core.paid_storage_costs (
                account_id,
                report_date,
                nm_id,
                vendor_code,
                size,
                warehouse_price,
                warehouse,
                office_id,
                barcode,
                subject,
                brand,
                chrt_id,
                raw_load_id,
                loaded_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
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
        rows = build_rows(account_id, load_id, payload)
        replace_account_period_by_date_column(
            conn,
            table_name="core.paid_storage_costs",
            date_column="report_date",
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
