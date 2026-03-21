import argparse
import sys
import uuid
from typing import Any

import psycopg

from courier.common import db_connection


SOURCE = "sellerInfo"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load normalized Wildberries seller-info from raw into core.seller_info."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def get_latest_payload(conn: psycopg.Connection, account_id: uuid.UUID) -> tuple[uuid.UUID, dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select lr.load_id, ap.payload
            from raw.load_runs lr
            join raw.api_payloads ap on ap.load_id = lr.load_id
            where lr.account_id = %s
              and lr.source = %s
              and lr.status = 'success'
            order by lr.fetched_at desc, ap.id desc
            limit 1
            """,
            (account_id, SOURCE),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("No successful raw sellerInfo load found for the account")
    return row[0], row[1]


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

    with db_connection() as conn:
        load_id, payload = get_latest_payload(conn, account_id)
        upsert_seller_info(conn, account_id, load_id, payload)
        conn.commit()

    print(f"source={SOURCE} load_id={load_id} rows_loaded=1")
    return 0


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
