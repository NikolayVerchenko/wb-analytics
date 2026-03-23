import argparse
import sys
import uuid

import psycopg

from courier.common import db_connection, get_token
from courier.raw_io import insert_raw_payload
from courier.raw_load_runner import RawLoadRunner, snapshot_date
from courier.wb_api_client import WbApiClient
from courier.wb_task_report import download_task, start_task, wait_task_done


CREATE_ENDPOINT = "https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains"
STATUS_ENDPOINT = (
    "https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/{task_id}/status"
)
DOWNLOAD_ENDPOINT = (
    "https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/{task_id}/download"
)
SOURCE = "warehouseRemains"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries warehouse remains report into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--poll-interval", type=int, default=5)
    parser.add_argument("--max-attempts", type=int, default=36)
    return parser.parse_args()


def extract_task_id(payload: dict) -> str:
    data = payload.get("data") or {}
    task_id = data.get("taskId")
    if not task_id:
        raise RuntimeError("Missing data.taskId in warehouse remains create response")
    return str(task_id)


def extract_status(payload: dict) -> str:
    data = payload.get("data") or {}
    status = data.get("status")
    if not status:
        raise RuntimeError("Missing data.status in warehouse remains status response")
    return str(status)


def run() -> int:
    args = parse_args()
    if args.poll_interval <= 0:
        raise ValueError("poll-interval must be positive")
    if args.max_attempts <= 0:
        raise ValueError("max-attempts must be positive")

    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    today = snapshot_date()

    with db_connection() as conn:
        runner = RawLoadRunner(conn=conn, load_id=load_id, account_id=account_id, source=SOURCE, period_from=today, period_to=today, period_mode="snapshot", week_start=today)
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            runner.start()
            task_id = start_task(client=client, source=SOURCE, create_url=CREATE_ENDPOINT, create_params={"locale": "ru", "groupByBrand": "true", "groupBySubject": "true", "groupBySa": "true", "groupByNm": "true", "groupByBarcode": "true", "groupBySize": "true"}, extract_task_id=extract_task_id)
            wait_task_done(client=client, source=SOURCE, task_id=task_id, status_url_template=STATUS_ENDPOINT, extract_status=extract_status, poll_interval=args.poll_interval, max_attempts=args.max_attempts, task_label="Warehouse remains")
            download_response = download_task(client=client, task_id=task_id, download_url_template=DOWNLOAD_ENDPOINT, expected_statuses={200})
            payload = download_response.json()
            if not isinstance(payload, list):
                raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")
            insert_raw_payload(conn, load_id=load_id, account_id=account_id, source=SOURCE, request_params={"task_id": task_id, "snapshot_date": today.isoformat()}, payload=payload, period_mode="snapshot", week_start=today)
            runner.succeed(len(payload))
            print(f"source={SOURCE} step=download http_status=200 rows_loaded={len(payload)}")
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
