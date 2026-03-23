import argparse
import sys
import uuid

import psycopg

from courier.common import db_connection, get_token, parse_iso_date
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner
from courier.wb_api_client import WbApiClient


ENDPOINT = "https://advert-api.wildberries.ru/adv/v1/upd"
SOURCE = "advUpd"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries advertising costs raw payloads into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    date_from = parse_iso_date(args.date_from)
    date_to = parse_iso_date(args.date_to)
    if date_from > date_to:
        raise ValueError("date-from must be <= date-to")

    load_id = uuid.uuid4()
    request_params = {"from": date_from.isoformat(), "to": date_to.isoformat()}

    with db_connection() as conn:
        runner = RawLoadRunner(
            conn=conn,
            load_id=load_id,
            account_id=account_id,
            source=SOURCE,
            period_from=date_from,
            period_to=date_to,
            period_mode="range",
            week_start=date_from,
        )
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()

            response = client.get(
                ENDPOINT,
                params=request_params,
                expected_statuses={200},
            )
            payload = response.json()
            if not isinstance(payload, list):
                raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")

            insert_raw_payload(
                conn,
                load_id=load_id,
                account_id=account_id,
                source=SOURCE,
                request_params=request_params,
                payload=payload,
                period_mode="range",
                week_start=date_from,
            )
            runner.succeed(len(payload))
            print(f"source={SOURCE} http_status=200 rows_loaded={len(payload)}")
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
