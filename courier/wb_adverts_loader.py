import argparse
import sys
import uuid
from datetime import datetime
from typing import Any

import psycopg

from courier.common import db_connection


SOURCE = "adverts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load Wildberries adverts from raw into core tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    normalized = str(value).replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def get_latest_payload(conn: psycopg.Connection, account_id: uuid.UUID) -> tuple[uuid.UUID, list[dict[str, Any]]]:
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
        raise RuntimeError("No successful raw adverts load found for the account")
    payload = row[1]
    adverts = payload.get("adverts") if isinstance(payload, dict) else None
    if not isinstance(adverts, list):
        raise RuntimeError("Expected payload.adverts to be a list")
    return row[0], adverts


def replace_snapshot(conn: psycopg.Connection, account_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        cur.execute("delete from core.advert_nms where account_id = %s", (account_id,))
        cur.execute("delete from core.adverts where account_id = %s", (account_id,))


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    adverts: list[dict[str, Any]],
) -> tuple[list[tuple], list[tuple]]:
    advert_rows: list[tuple] = []
    nm_rows: list[tuple] = []
    for advert in adverts:
        advert_id = advert.get("id")
        if advert_id is None:
            continue
        settings = advert.get("settings") or {}
        timestamps = advert.get("timestamps") or {}
        advert_rows.append(
            (
                account_id,
                int(advert_id),
                settings.get("name"),
                settings.get("payment_type"),
                int_or_none(advert.get("status")),
                advert.get("bid_type"),
                parse_dt(timestamps.get("created")),
                parse_dt(timestamps.get("started")),
                parse_dt(timestamps.get("updated")),
                parse_dt(timestamps.get("deleted")),
                load_id,
            )
        )

        for item in advert.get("nm_settings") or []:
            bids = item.get("bids_kopecks") or {}
            subject = item.get("subject") or {}
            nm_id = item.get("nm_id")
            if nm_id is None:
                continue
            nm_rows.append(
                (
                    account_id,
                    int(advert_id),
                    int(nm_id),
                    int_or_none(subject.get("id")),
                    subject.get("name"),
                    int_or_none(bids.get("search")),
                    int_or_none(bids.get("recommendations")),
                    load_id,
                )
            )
    return advert_rows, nm_rows


def insert_rows(
    conn: psycopg.Connection,
    advert_rows: list[tuple],
    nm_rows: list[tuple],
) -> None:
    with conn.cursor() as cur:
        if advert_rows:
            cur.executemany(
                """
                insert into core.adverts (
                    account_id,
                    advert_id,
                    campaign_name,
                    payment_type,
                    status,
                    bid_type,
                    created_at_wb,
                    started_at_wb,
                    updated_at_wb,
                    deleted_at_wb,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                """,
                advert_rows,
                )
        if nm_rows:
            cur.executemany(
                """
                insert into core.advert_nms (
                    account_id,
                    advert_id,
                    nm_id,
                    subject_id,
                    subject_name,
                    bid_search_kopecks,
                    bid_recommendations_kopecks,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, now())
                """,
                nm_rows,
                )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    with db_connection() as conn:
        load_id, adverts = get_latest_payload(conn, account_id)
        advert_rows, nm_rows = build_rows(account_id, load_id, adverts)
        replace_snapshot(conn, account_id)
        insert_rows(conn, advert_rows, nm_rows)
        conn.commit()

    print(
        f"source={SOURCE} load_id={load_id} adverts={len(advert_rows)} advert_nms={len(nm_rows)}"
    )
    return 0


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
