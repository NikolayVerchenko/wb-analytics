import argparse
import sys
import uuid
from datetime import datetime
from typing import Any

import psycopg

from courier.core_load_runner import CoreLoadResult, run_core_load
from courier.core_replace import replace_account_snapshot
from courier.raw_read import fetch_latest_single_payload


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

    def load(conn: psycopg.Connection) -> CoreLoadResult:
        load_id, payload = fetch_latest_single_payload(conn, account_id=account_id, source=SOURCE)
        if not isinstance(payload, dict):
            raise RuntimeError(f"Expected object payload, got {type(payload).__name__}")
        adverts = payload.get("adverts") if isinstance(payload, dict) else None
        if not isinstance(adverts, list):
            raise RuntimeError("Expected payload.adverts to be a list")
        advert_rows, nm_rows = build_rows(account_id, load_id, adverts)
        replace_account_snapshot(
            conn,
            account_id=account_id,
            table_names=("core.advert_nms", "core.adverts"),
        )
        insert_rows(conn, advert_rows, nm_rows)
        return CoreLoadResult(
            source=SOURCE,
            load_id=str(load_id),
            metrics={"adverts": len(advert_rows), "advert_nms": len(nm_rows)},
        )

    return run_core_load(load)


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
