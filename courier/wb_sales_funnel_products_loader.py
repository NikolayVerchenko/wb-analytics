import argparse
import sys
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import db_connection, parse_iso_date


SOURCE = "salesFunnelProducts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries product funnel analytics from raw into core.product_funnel."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def get_latest_payload_pages(
    conn: psycopg.Connection,
    account_id: uuid.UUID,
    date_from,
    date_to,
) -> tuple[uuid.UUID, list[dict[str, Any]]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select lr.load_id
            from raw.load_runs lr
            where lr.account_id = %s
              and lr.source = %s
              and lr.status = 'success'
              and lr.period_from = %s
              and lr.period_to = %s
              and lr.period_mode = 'range'
            order by lr.fetched_at desc
            limit 1
            """,
            (account_id, SOURCE, date_from, date_to),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("No successful raw sales funnel load found for the requested period")
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


def replace_period(conn: psycopg.Connection, account_id, date_from, date_to) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            delete from core.product_funnel
            where account_id = %s
              and period_from = %s
              and period_to = %s
            """,
            (account_id, date_from, date_to),
        )


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload_pages: list[dict[str, Any]],
    date_from,
    date_to,
) -> list[tuple]:
    rows: list[tuple] = []
    seen_nm_ids: set[int] = set()
    for payload in payload_pages:
        data = payload.get("data") or {}
        for item in data.get("products") or []:
            product = item.get("product") or {}
            statistic = item.get("statistic") or {}
            selected = statistic.get("selected") or {}
            comparison = statistic.get("comparison") or {}
            stocks = product.get("stocks") or {}
            conversions = selected.get("conversions") or {}
            nm_id = product.get("nmId")
            if nm_id is None:
                continue
            nm_id = int(nm_id)
            if nm_id in seen_nm_ids:
                continue
            seen_nm_ids.add(nm_id)
            rows.append(
                (
                    account_id,
                    nm_id,
                    product.get("vendorCode"),
                    product.get("brandName"),
                    int_or_none(product.get("subjectId")),
                    product.get("subjectName"),
                    decimal_or_none(product.get("productRating")),
                    decimal_or_none(product.get("feedbackRating")),
                    int_or_none(stocks.get("wb")),
                    int_or_none(stocks.get("mp")),
                    decimal_or_none(stocks.get("balanceSum")),
                    date_from,
                    date_to,
                    int_or_none(selected.get("openCount")),
                    int_or_none(selected.get("cartCount")),
                    int_or_none(selected.get("orderCount")),
                    decimal_or_none(selected.get("orderSum")),
                    int_or_none(selected.get("buyoutCount")),
                    decimal_or_none(selected.get("buyoutSum")),
                    int_or_none(selected.get("cancelCount")),
                    decimal_or_none(selected.get("cancelSum")),
                    decimal_or_none(selected.get("avgPrice")),
                    decimal_or_none(selected.get("avgOrdersCountPerDay")),
                    decimal_or_none(selected.get("shareOrderPercent")),
                    int_or_none(selected.get("addToWishlist")),
                    decimal_or_none(selected.get("localizationPercent")),
                    decimal_or_none(conversions.get("addToCartPercent")),
                    decimal_or_none(conversions.get("cartToOrderPercent")),
                    decimal_or_none(conversions.get("buyoutPercent")),
                    decimal_or_none(comparison.get("openCountDynamic")),
                    decimal_or_none(comparison.get("cartCountDynamic")),
                    decimal_or_none(comparison.get("orderCountDynamic")),
                    decimal_or_none(comparison.get("orderSumDynamic")),
                    decimal_or_none(comparison.get("buyoutCountDynamic")),
                    decimal_or_none(comparison.get("buyoutSumDynamic")),
                    decimal_or_none(comparison.get("cancelCountDynamic")),
                    decimal_or_none(comparison.get("cancelSumDynamic")),
                    decimal_or_none(comparison.get("avgPriceDynamic")),
                    decimal_or_none(comparison.get("addToWishlistDynamic")),
                    decimal_or_none(comparison.get("localizationPercentDynamic")),
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
            insert into core.product_funnel (
                account_id,
                nm_id,
                vendor_code,
                brand_name,
                subject_id,
                subject_name,
                product_rating,
                feedback_rating,
                stock_wb,
                stock_mp,
                stock_balance_sum,
                period_from,
                period_to,
                open_count,
                cart_count,
                order_count,
                order_sum,
                buyout_count,
                buyout_sum,
                cancel_count,
                cancel_sum,
                avg_price,
                avg_orders_count_per_day,
                share_order_percent,
                add_to_wishlist,
                localization_percent,
                add_to_cart_percent,
                cart_to_order_percent,
                buyout_percent,
                open_count_dynamic,
                cart_count_dynamic,
                order_count_dynamic,
                order_sum_dynamic,
                buyout_count_dynamic,
                buyout_sum_dynamic,
                cancel_count_dynamic,
                cancel_sum_dynamic,
                avg_price_dynamic,
                add_to_wishlist_dynamic,
                localization_percent_dynamic,
                raw_load_id,
                loaded_at
            )
            values (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
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

    with db_connection() as conn:
        load_id, payload_pages = get_latest_payload_pages(conn, account_id, date_from, date_to)
        rows = build_rows(account_id, load_id, payload_pages, date_from, date_to)
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
