import argparse
import sys
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import get_week_start, parse_iso_date
from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_period_by_date_column
from courier.raw_read import fetch_latest_payload_pages


SOURCE = "reportDetailByPeriod"
TARGET_TABLES = {
    "daily": "core.report_detail_daily",
    "weekly": "core.report_detail_weekly",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load normalized WB reportDetailByPeriod rows from raw into core tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--mode", required=True, choices=("daily", "weekly"))
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def numeric_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def map_payload_item(account_id: uuid.UUID, item: dict[str, Any]) -> tuple:
    rr_dt_value = item.get("rr_dt")
    if not rr_dt_value:
        raise RuntimeError("Missing rr_dt in raw payload item")

    rr_dt = date.fromisoformat(rr_dt_value)
    row_week_start = get_week_start(rr_dt)
    sa_name = item.get("sa_name")
    ts_name = item.get("ts_name")
    ppvz_for_pay = numeric_or_none(item.get("ppvz_for_pay"))
    delivery_rub = numeric_or_none(item.get("delivery_rub"))
    penalty = numeric_or_none(item.get("penalty"))

    return (
        account_id,
        int_or_none(item.get("rrd_id")),
        rr_dt,
        sa_name,
        ts_name,
        ppvz_for_pay,
        None,
        delivery_rub,
        None,
        penalty,
        None,
        row_week_start,
        item.get("gi_id"),
        item.get("subject_name"),
        item.get("nm_id"),
        item.get("brand_name"),
        sa_name,
        ts_name,
        int_or_none(item.get("quantity")),
        numeric_or_none(item.get("retail_price")),
        numeric_or_none(item.get("retail_amount")),
        item.get("supplier_oper_name"),
        int_or_none(item.get("delivery_amount")),
        int_or_none(item.get("return_amount")),
        delivery_rub,
        ppvz_for_pay,
        numeric_or_none(item.get("acquiring_fee")),
        item.get("bonus_type_name"),
        penalty,
        numeric_or_none(item.get("additional_payment")),
        numeric_or_none(item.get("cashback_amount")),
    )


def insert_core_rows(
    conn: psycopg.Connection,
    table_name: str,
    rows: list[tuple],
) -> None:
    if not rows:
        return

    with conn.cursor() as cur:
        cur.executemany(
            f"""
            insert into {table_name} (
                account_id,
                rrd_id,
                rr_dt,
                vendor_code,
                size_norm,
                revenue,
                commission,
                logistics,
                storage,
                penalties,
                services,
                week_start,
                gi_id,
                subject_name,
                nm_id,
                brand_name,
                sa_name,
                ts_name,
                quantity,
                retail_price,
                retail_amount,
                supplier_oper_name,
                delivery_amount,
                return_amount,
                delivery_rub,
                ppvz_for_pay,
                acquiring_fee,
                bonus_type_name,
                penalty,
                additional_payment,
                cashback_amount,
                loaded_at
            )
            values (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
            )
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

    week_start = get_week_start(date_from)
    table_name = TARGET_TABLES[args.mode]

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload_pages = fetch_latest_payload_pages(
            conn,
            account_id=account_id,
            source=SOURCE,
            period_from=date_from,
            period_to=date_to,
            period_mode=args.mode,
            week_start=week_start,
        )
        rows: list[tuple] = []
        for page in payload_pages:
            for item in page:
                rows.append(map_payload_item(account_id, item))

        replace_account_period_by_date_column(
            conn,
            table_name=table_name,
            date_column="rr_dt",
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
        )
        insert_core_rows(conn, table_name, rows)
        return CoreLoadResult(
            source=SOURCE,
            load_id=str(load_id),
            metrics={"mode": args.mode, "table": table_name, "rows_loaded": len(rows)},
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
