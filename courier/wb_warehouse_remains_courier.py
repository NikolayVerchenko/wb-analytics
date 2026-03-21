import argparse
import sys
import time
import uuid
from datetime import datetime

import psycopg
import requests

from courier.common import db_connection, get_token
from courier.raw_io import create_raw_load_run, insert_raw_payload, update_raw_load_run
from courier.raw_period_replace import replace_raw_period_data


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


def create_load_run(conn: psycopg.Connection, load_id: uuid.UUID, account_id: uuid.UUID) -> datetime.date:
    snapshot_date = datetime.now().date()
    create_raw_load_run(
        conn,
        load_id=load_id,
        account_id=account_id,
        source=SOURCE,
        period_from=snapshot_date,
        period_to=snapshot_date,
        period_mode="snapshot",
        week_start=snapshot_date,
    )
    return snapshot_date


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

    with db_connection() as conn:
        try:
            token = get_token(conn, account_id)
            snapshot_date = datetime.now().date()
            replace_raw_period_data(
                conn,
                account_id=account_id,
                source=SOURCE,
                period_from=snapshot_date,
                period_to=snapshot_date,
                period_mode="snapshot",
                week_start=snapshot_date,
            )
            snapshot_date = create_load_run(conn, load_id, account_id)
            conn.commit()

            create_response = requests.get(
                CREATE_ENDPOINT,
                headers={"Authorization": token},
                params={
                    "locale": "ru",
                    "groupByBrand": "true",
                    "groupBySubject": "true",
                    "groupBySa": "true",
                    "groupByNm": "true",
                    "groupByBarcode": "true",
                    "groupBySize": "true",
                },
                timeout=60,
            )
            if create_response.status_code != 200:
                error_text = (create_response.text or "").strip() or f"HTTP {create_response.status_code}"
                update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=0, error=error_text)
                conn.commit()
                print(f"source={SOURCE} step=create http_status={create_response.status_code}")
                return 1

            create_payload = create_response.json()
            task_id = extract_task_id(create_payload)
            print(f"source={SOURCE} step=create http_status=200 task_id={task_id}")

            final_status = None
            for attempt in range(1, args.max_attempts + 1):
                status_response = requests.get(
                    STATUS_ENDPOINT.format(task_id=task_id),
                    headers={"Authorization": token},
                    timeout=60,
                )
                if status_response.status_code != 200:
                    error_text = (status_response.text or "").strip() or f"HTTP {status_response.status_code}"
                    update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=0, error=error_text)
                    conn.commit()
                    print(
                        f"source={SOURCE} step=status http_status={status_response.status_code} "
                        f"attempt={attempt} task_id={task_id}"
                    )
                    return 1

                status_payload = status_response.json()
                final_status = extract_status(status_payload)
                print(
                    f"source={SOURCE} step=status http_status=200 attempt={attempt} "
                    f"task_id={task_id} status={final_status}"
                )
                if final_status == "done":
                    break
                if final_status in {"error", "failed"}:
                    raise RuntimeError(f"Warehouse remains task failed with status={final_status}")
                time.sleep(args.poll_interval)
            else:
                raise RuntimeError("Warehouse remains task polling timed out")

            download_response = requests.get(
                DOWNLOAD_ENDPOINT.format(task_id=task_id),
                headers={"Authorization": token},
                timeout=60,
            )
            if download_response.status_code != 200:
                error_text = (download_response.text or "").strip() or f"HTTP {download_response.status_code}"
                update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=0, error=error_text)
                conn.commit()
                print(f"source={SOURCE} step=download http_status={download_response.status_code}")
                return 1

            payload = download_response.json()
            if not isinstance(payload, list):
                raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")

            insert_raw_payload(
                conn,
                load_id=load_id,
                account_id=account_id,
                source=SOURCE,
                request_params={
                    "task_id": task_id,
                    "snapshot_date": snapshot_date.isoformat(),
                },
                payload=payload,
                period_mode="snapshot",
                week_start=snapshot_date,
            )
            update_raw_load_run(conn, load_id=load_id, status="success", rows_loaded=len(payload), error=None)
            conn.commit()
            print(f"source={SOURCE} step=download http_status=200 rows_loaded={len(payload)}")
            return 0
        except Exception as exc:
            conn.rollback()
            try:
                update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=0, error=str(exc))
                conn.commit()
            except Exception:
                conn.rollback()
            raise


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
