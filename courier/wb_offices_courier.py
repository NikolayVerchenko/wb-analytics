import argparse
import sys
import uuid

import psycopg

from courier.common import db_connection, get_token
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner, snapshot_date
from courier.wb_api_client import WbApiClient


ENDPOINT = "https://marketplace-api.wildberries.ru/api/v3/offices"
SOURCE = "wbOffices"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries offices raw payload into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    today = snapshot_date()

    with db_connection() as conn:
        runner = RawLoadRunner(
            conn=conn,
            load_id=load_id,
            account_id=account_id,
            source=SOURCE,
            period_from=today,
            period_to=today,
            period_mode="snapshot",
            week_start=today,
        )
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()

            response = client.get(
                ENDPOINT,
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
                request_params={},
                payload=payload,
                period_mode=None,
                week_start=None,
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
