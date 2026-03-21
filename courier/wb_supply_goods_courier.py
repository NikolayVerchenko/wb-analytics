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


ENDPOINT_TEMPLATE = "https://supplies-api.wildberries.ru/api/v1/supplies/{id}/goods"
SOURCE = "supplyGoods"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Wildberries supply goods into raw tables from the latest supplies snapshot."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    parser.add_argument("--limit", type=int, default=100)
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

def get_supply_targets(conn: psycopg.Connection, account_id: uuid.UUID) -> list[tuple[int, bool]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select coalesce(supply_id, preorder_id) as target_id, (supply_id is null) as is_preorder_id
            from core.supplies
            where account_id = %s
            order by preorder_id
            """,
            (account_id,),
        )
        rows = cur.fetchall()
    if not rows:
        raise RuntimeError("No rows in core.supplies; run the supplies loader first")
    return [(int(row[0]), bool(row[1])) for row in rows if row[0] is not None]


def run() -> int:
    args = parse_args()
    if args.limit <= 0 or args.limit > 1000:
        raise ValueError("limit must be between 1 and 1000")

    account_id = uuid.UUID(args.account_id)
    load_id = uuid.uuid4()
    total_rows = 0

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
            targets = get_supply_targets(conn, account_id)
            conn.commit()

            for target_id, is_preorder_id in targets:
                offset = 0
                while True:
                    response = requests.get(
                        ENDPOINT_TEMPLATE.format(id=target_id),
                        headers={"Authorization": token},
                        params={
                            "limit": args.limit,
                            "offset": offset,
                            "isPreorderID": str(is_preorder_id).lower(),
                        },
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
                            f"source={SOURCE} http_status={response.status_code} page_rows=0 total_rows={total_rows} "
                            f"target_id={target_id} is_preorder_id={is_preorder_id} offset={offset}"
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
                            "target_id": target_id,
                            "is_preorder_id": is_preorder_id,
                            "limit": args.limit,
                            "offset": offset,
                        },
                        payload=payload,
                        period_mode="snapshot",
                        week_start=snapshot_date,
                    )
                    total_rows += page_rows
                    conn.commit()

                    print(
                        f"source={SOURCE} http_status=200 page_rows={page_rows} total_rows={total_rows} "
                        f"target_id={target_id} is_preorder_id={is_preorder_id} offset={offset}"
                    )

                    if page_rows < args.limit:
                        break
                    offset += args.limit
                    time.sleep(2)

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
