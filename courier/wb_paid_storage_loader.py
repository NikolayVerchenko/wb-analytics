import argparse
import sys
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import db_connection, parse_iso_date


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
        raise RuntimeError("No successful raw paid storage load found for the requested period")
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
            delete from core.paid_storage_costs
            where account_id = %s
              and report_date >= %s
              and report_date <= %s
            """,
            (account_id, date_from, date_to),
        )


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

    with db_connection() as conn:
        load_id, payload = get_latest_payload(conn, account_id, date_from, date_to)
        rows = build_rows(account_id, load_id, payload)
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
