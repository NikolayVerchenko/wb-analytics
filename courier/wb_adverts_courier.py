import argparse
import sys
import uuid
from datetime import datetime

import psycopg
import requests

from courier.common import db_connection, get_token
from courier.raw_io import create_raw_load_run, insert_raw_payload, update_raw_load_run


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


def create_load_run(conn: psycopg.Connection, load_id: uuid.UUID, account_id: uuid.UUID) -> None:
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

    with db_connection() as conn:
        try:
            token = get_token(conn, account_id)
            create_load_run(conn, load_id, account_id)
            conn.commit()

            response = requests.get(
                ENDPOINT,
                headers={"Authorization": token},
                params=request_params,
                timeout=60,
            )
            if response.status_code != 200:
                error_text = (response.text or "").strip() or f"HTTP {response.status_code}"
                update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=0, error=error_text)
                conn.commit()
                print(f"source={SOURCE} http_status={response.status_code} rows_loaded=0")
                return 1

            payload = response.json()
            if not isinstance(payload, dict):
                raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")

            adverts = payload.get("adverts")
            if not isinstance(adverts, list):
                raise RuntimeError("Expected payload.adverts to be a list")

            insert_raw_payload(
                conn,
                load_id=load_id,
                account_id=account_id,
                source=SOURCE,
                request_params=request_params,
                payload=payload,
                period_mode=None,
                week_start=None,
            )
            update_raw_load_run(conn, load_id=load_id, status="success", rows_loaded=len(adverts), error=None)
            conn.commit()
            print(f"source={SOURCE} http_status=200 rows_loaded={len(adverts)}")
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
