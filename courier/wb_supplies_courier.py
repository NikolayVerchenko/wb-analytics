import argparse
import sys
import time
import uuid
from datetime import timedelta

import psycopg

from courier.common import db_connection, get_token
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner, snapshot_date
from courier.wb_api_client import WbApiClient


ENDPOINT = "https://supplies-api.wildberries.ru/api/v1/supplies"
SOURCE = "supplies"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries supplies list into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--statuses", default=None, help="Comma-separated status IDs")
    parser.add_argument("--date-type", default="factDate", choices=("createDate", "supplyDate", "factDate", "updatedDate"), help="Date field used in supplies filter")
    return parser.parse_args()


def build_body(statuses: str | None, date_type: str) -> dict:
    today = snapshot_date()
    from_date = today - timedelta(days=365)
    body = {"dates": [{"from": from_date.isoformat(), "till": today.isoformat(), "type": date_type}]}
    if statuses:
        body["statusIDs"] = [int(item.strip()) for item in statuses.split(",") if item.strip()]
    return body


def run() -> int:
    args = parse_args()
    if args.limit <= 0 or args.limit > 1000:
        raise ValueError("limit must be between 1 and 1000")

    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    total_rows = 0
    offset = 0
    today = snapshot_date()

    with db_connection() as conn:
        runner = RawLoadRunner(conn=conn, load_id=load_id, account_id=account_id, source=SOURCE, period_from=today, period_to=today, period_mode="snapshot", week_start=today)
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()
            while True:
                body = build_body(args.statuses, args.date_type)
                response = client.post(ENDPOINT, params={"limit": args.limit, "offset": offset}, json=body, headers={"Content-Type": "application/json"}, expected_statuses={200})
                payload = response.json()
                if not isinstance(payload, list):
                    raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
                page_rows = len(payload)
                insert_raw_payload(conn, load_id=load_id, account_id=account_id, source=SOURCE, request_params={"snapshot_date": today.isoformat(), "limit": args.limit, "offset": offset, "statuses": args.statuses}, payload=payload, period_mode="snapshot", week_start=today)
                total_rows += page_rows
                conn.commit()
                print(f"source={SOURCE} http_status=200 page_rows={page_rows} total_rows={total_rows} offset={offset}")
                if page_rows < args.limit:
                    break
                offset += args.limit
                time.sleep(2)
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
