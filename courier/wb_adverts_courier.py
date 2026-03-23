import argparse
import sys
import uuid

import psycopg

from courier.common import db_connection, get_token
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner, snapshot_date
from courier.wb_api_client import WbApiClient


ENDPOINT = "https://advert-api.wildberries.ru/api/advert/v2/adverts"
SOURCE = "adverts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries adverts raw payload into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--statuses", help="Comma-separated statuses", default=None)
    parser.add_argument("--payment-type", choices=("cpm", "cpc"), default=None)
    parser.add_argument("--ids", help="Comma-separated advert IDs, max 50", default=None)
    return parser.parse_args()


def build_params(args: argparse.Namespace) -> dict[str, str]:
    params: dict[str, str] = {}
    if args.statuses:
        params["statuses"] = args.statuses
    if args.payment_type:
        params["payment_type"] = args.payment_type
    if args.ids:
        params["ids"] = args.ids
    return params


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    request_params = build_params(args)
    today = snapshot_date()

    with db_connection() as conn:
        runner = RawLoadRunner(conn=conn, load_id=load_id, account_id=account_id, source=SOURCE, period_from=today, period_to=today, period_mode="snapshot", week_start=today)
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()
            response = client.get(ENDPOINT, params=request_params, expected_statuses={200})
            payload = response.json()
            if not isinstance(payload, dict):
                raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")
            adverts = payload.get("adverts")
            if not isinstance(adverts, list):
                raise RuntimeError("Expected payload.adverts to be a list")
            insert_raw_payload(conn, load_id=load_id, account_id=account_id, source=SOURCE, request_params=request_params, payload=payload, period_mode=None, week_start=None)
            runner.succeed(len(adverts))
            print(f"source={SOURCE} http_status=200 rows_loaded={len(adverts)}")
            return 0
        except Exception as exc:
            runner.fail(rows_loaded=0, error=str(exc))
            raise


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
