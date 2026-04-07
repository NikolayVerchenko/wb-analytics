import argparse
import sys
import time
import uuid
from datetime import date, timedelta

import psycopg

from courier.common import db_connection, get_token, parse_iso_date
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner
from courier.wb_api_client import WbApiClient


ENDPOINT = "https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products"
SOURCE = "salesFunnelProducts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries sales funnel products raw payloads into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    parser.add_argument("--past-date-from", help="YYYY-MM-DD", default=None)
    parser.add_argument("--past-date-to", help="YYYY-MM-DD", default=None)
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--skip-deleted-nm", action="store_true")
    return parser.parse_args()


def default_past_period(date_from: date, date_to: date) -> tuple[date, date]:
    delta_days = (date_to - date_from).days + 1
    past_end = date_from - timedelta(days=1)
    past_start = past_end - timedelta(days=delta_days - 1)
    return past_start, past_end


def build_request_body(date_from: date, date_to: date, past_date_from: date, past_date_to: date, limit: int, offset: int, skip_deleted_nm: bool) -> dict:
    return {
        "selectedPeriod": {"start": date_from.isoformat(), "end": date_to.isoformat()},
        "pastPeriod": {"start": past_date_from.isoformat(), "end": past_date_to.isoformat()},
        "nmIds": [],
        "brandNames": [],
        "subjectIds": [],
        "tagIds": [],
        "skipDeletedNm": skip_deleted_nm,
        "limit": limit,
        "offset": offset,
    }


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    date_from = parse_iso_date(args.date_from)
    date_to = parse_iso_date(args.date_to)
    if date_from > date_to:
        raise ValueError("date-from must be <= date-to")
    if args.limit <= 0 or args.limit > 1000:
        raise ValueError("limit must be between 1 and 1000")

    if args.past_date_from and args.past_date_to:
        past_date_from = parse_iso_date(args.past_date_from)
        past_date_to = parse_iso_date(args.past_date_to)
    elif args.past_date_from or args.past_date_to:
        raise ValueError("past-date-from and past-date-to must be provided together")
    else:
        past_date_from, past_date_to = default_past_period(date_from, date_to)

    load_id = uuid.uuid4()
    total_rows = 0
    offset = 0

    with db_connection() as conn:
        runner = RawLoadRunner(conn=conn, load_id=load_id, account_id=account_id, source=SOURCE, period_from=date_from, period_to=date_to, period_mode="range", week_start=date_from)
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()
            while True:
                request_body = build_request_body(date_from, date_to, past_date_from, past_date_to, args.limit, offset, args.skip_deleted_nm)
                response = client.post(ENDPOINT, json=request_body, headers={"Content-Type": "application/json"}, expected_statuses={200})
                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")
                data = payload.get("data") or {}
                products = data.get("products")
                if not isinstance(products, list):
                    raise RuntimeError("Expected payload.data.products to be a list")
                page_rows = len(products)
                insert_raw_payload(conn, load_id=load_id, account_id=account_id, source=SOURCE, request_params=request_body, payload=payload, period_mode="range", week_start=date_from)
                total_rows += page_rows
                conn.commit()
                print(f"source={SOURCE} http_status=200 page_rows={page_rows} total_rows={total_rows} offset={offset}")
                if page_rows < args.limit:
                    break
                offset += args.limit
                time.sleep(20)
            runner.succeed(total_rows)
            return 0
        except Exception as exc:
            runner.fail(rows_loaded=total_rows, error=str(exc))
            raise


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
