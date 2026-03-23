import argparse
import sys
import uuid
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.raw_read import fetch_latest_single_payload


SOURCE = "sellerInfo"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load normalized Wildberries seller-info from raw into core.seller_info."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def upsert_seller_info(
    conn: psycopg.Connection,
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload: dict[str, Any],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into core.seller_info (
                account_id,
                wb_seller_id,
                seller_name,
                trade_mark,
                raw_load_id,
                loaded_at
            )
            values (%s, %s, %s, %s, %s, now())
            on conflict (account_id) do update
            set wb_seller_id = excluded.wb_seller_id,
                seller_name = excluded.seller_name,
                trade_mark = excluded.trade_mark,
                raw_load_id = excluded.raw_load_id,
                loaded_at = now()
            """,
            (
                account_id,
                str(payload.get("sid")) if payload.get("sid") is not None else None,
                payload.get("name"),
                payload.get("tradeMark"),
                load_id,
            ),
        )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(conn, account_id=account_id, source=SOURCE)
        if not isinstance(payload, dict):
            raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")
        upsert_seller_info(conn, account_id, load_id, payload)
        return CoreLoadResult(source=SOURCE, load_id=str(load_id), metrics={"rows_loaded": 1})

    return run_core_load(load)


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
