import argparse
import sys
import time
import uuid
from datetime import datetime, timedelta

import psycopg
import requests

from courier.common import db_connection, get_token
from courier.raw_io import create_raw_load_run, insert_raw_payload, update_raw_load_run
from courier.raw_period_replace import replace_raw_period_data


ENDPOINT = "https://supplies-api.wildberries.ru/api/v1/supplies"
SOURCE = "supplies"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries supplies list into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--statuses", default=None, help="Comma-separated status IDs")
    parser.add_argument(
        "--date-type",
        default="factDate",
        choices=("createDate", "supplyDate", "factDate", "updatedDate"),
        help="Date field used in supplies filter",
    )
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

def build_body(statuses: str | None, date_type: str) -> dict:
    today = datetime.now().date()
    from_date = today - timedelta(days=365)
    body = {
        "dates": [
            {
                "from": from_date.isoformat(),
                "till": today.isoformat(),
                "type": date_type,
            }
        ]
    }
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

            while True:
                body = build_body(args.statuses, args.date_type)
                response = requests.post(
                    ENDPOINT,
                    headers={"Authorization": token, "Content-Type": "application/json"},
                    params={"limit": args.limit, "offset": offset},
                    json=body,
                    timeout=60,
                )
                if response.status_code != 200:
                    error_text = (response.text or "").strip() or f"HTTP {response.status_code}"
                    update_raw_load_run(
                        conn,
                        load_id=load_id,
                        status="failed",
                        rows_loaded=total_rows,
                        error=error_text,
                    )
                    conn.commit()
                    print(
                        f"source={SOURCE} http_status={response.status_code} page_rows=0 "
                        f"total_rows={total_rows} offset={offset}"
                    )
                    return 1

                payload = response.json()
                if not isinstance(payload, list):
                    raise RuntimeError(f"Expected list payload, got {type(payload).__name__}")

                page_rows = len(payload)
                insert_raw_payload(
                    conn,
                    load_id=load_id,
                    account_id=account_id,
                    source=SOURCE,
                    request_params={
                        "snapshot_date": snapshot_date.isoformat(),
                        "limit": args.limit,
                        "offset": offset,
                        "statuses": args.statuses,
                    },
                    payload=payload,
                    period_mode="snapshot",
                    week_start=snapshot_date,
                )
                total_rows += page_rows
                conn.commit()

                print(
                    f"source={SOURCE} http_status=200 page_rows={page_rows} "
                    f"total_rows={total_rows} offset={offset}"
                )

                if page_rows < args.limit:
                    break
                offset += args.limit
                time.sleep(2)

            update_raw_load_run(
                conn,
                load_id=load_id,
                status="success",
                rows_loaded=total_rows,
                error=None,
            )
            conn.commit()
            return 0
        except Exception as exc:
            conn.rollback()
            try:
                update_raw_load_run(
                    conn,
                    load_id=load_id,
                    status="failed",
                    rows_loaded=total_rows,
                    error=str(exc),
                )
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
