import argparse
import sys
import time
import uuid
from datetime import datetime

import psycopg
import requests

from courier.common import db_connection, get_token
from courier.raw_io import create_raw_load_run, insert_raw_payload, update_raw_load_run


ENDPOINT = "https://content-api.wildberries.ru/content/v2/get/cards/list"
SOURCE = "cardsList"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries cards list raw payloads into raw tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--limit", type=int, default=100)
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


def fetch_page(token: str, request_body: dict) -> requests.Response:
    return requests.post(
        ENDPOINT,
        headers={
            "Authorization": token,
            "Content-Type": "application/json",
        },
        json=request_body,
        timeout=60,
    )


def run() -> int:
    args = parse_args()
    if args.limit <= 0 or args.limit > 100:
        raise ValueError("limit must be between 1 and 100")

    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    total_cards = 0
    cursor_updated_at = None
    cursor_nm_id = None

    with db_connection() as conn:
        try:
            token = get_token(conn, account_id)
            create_load_run(conn, load_id, account_id)
            conn.commit()

            while True:
                request_body = {
                    "settings": {
                        "sort": {"ascending": True},
                        "cursor": {"limit": args.limit},
                        "filter": {"withPhoto": -1},
                    }
                }
                if cursor_updated_at is not None:
                    request_body["settings"]["cursor"]["updatedAt"] = cursor_updated_at
                if cursor_nm_id is not None:
                    request_body["settings"]["cursor"]["nmID"] = cursor_nm_id

                response = fetch_page(token, request_body)
                http_status = response.status_code
                page_cards = 0

                if http_status != 200:
                    error_text = (response.text or "").strip() or f"HTTP {http_status}"
                    update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=total_cards, error=error_text)
                    conn.commit()
                    print(
                        f"source={SOURCE} http_status={http_status} page_cards=0 total_cards={total_cards}"
                    )
                    return 1

                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")

                cards = payload.get("cards")
                if not isinstance(cards, list):
                    raise RuntimeError("Expected payload.cards to be a list")

                page_cards = len(cards)
                insert_raw_payload(
                    conn,
                    load_id=load_id,
                    account_id=account_id,
                    source=SOURCE,
                    request_params=request_body,
                    payload=payload,
                    period_mode=None,
                    week_start=None,
                )
                total_cards += page_cards
                conn.commit()

                next_cursor = payload.get("cursor") or {}
                next_updated_at = next_cursor.get("updatedAt")
                next_nm_id = next_cursor.get("nmID")
                next_total = next_cursor.get("total")

                print(
                    f"source={SOURCE} http_status={http_status} page_cards={page_cards} "
                    f"total_cards={total_cards} cursor_total={next_total} "
                    f"cursor_updated_at={next_updated_at} cursor_nm_id={next_nm_id}"
                )

                if not cards:
                    break
                if isinstance(next_total, int) and next_total < args.limit:
                    break
                if next_updated_at == cursor_updated_at and next_nm_id == cursor_nm_id:
                    raise RuntimeError("Pagination stalled for cardsList cursor")
                if next_updated_at is None or next_nm_id is None:
                    break

                cursor_updated_at = next_updated_at
                cursor_nm_id = next_nm_id
                time.sleep(1)

            update_raw_load_run(conn, load_id=load_id, status="success", rows_loaded=total_cards, error=None)
            conn.commit()
            return 0
        except Exception as exc:
            conn.rollback()
            try:
                update_raw_load_run(conn, load_id=load_id, status="failed", rows_loaded=total_cards, error=str(exc))
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
