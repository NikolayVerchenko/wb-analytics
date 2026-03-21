import hashlib
import json
from datetime import date
from uuid import UUID

import psycopg


def canonical_payload_hash(payload: object) -> str:
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def create_raw_load_run(
    conn: psycopg.Connection,
    *,
    load_id: UUID,
    account_id: UUID,
    source: str,
    period_from: date,
    period_to: date,
    period_mode: str,
    week_start: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into raw.load_runs (
                load_id,
                account_id,
                source,
                period_from,
                period_to,
                fetched_at,
                status,
                rows_loaded,
                error,
                period_mode,
                week_start
            )
            values (%s, %s, %s, %s, %s, now(), %s, %s, %s, %s, %s)
            """,
            (
                load_id,
                account_id,
                source,
                period_from,
                period_to,
                "started",
                0,
                None,
                period_mode,
                week_start,
            ),
        )


def update_raw_load_run(
    conn: psycopg.Connection,
    *,
    load_id: UUID,
    status: str,
    rows_loaded: int,
    error: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            update raw.load_runs
            set status = %s,
                rows_loaded = %s,
                error = %s
            where load_id = %s
            """,
            (status, rows_loaded, error, load_id),
        )


def insert_raw_payload(
    conn: psycopg.Connection,
    *,
    load_id: UUID,
    account_id: UUID,
    source: str,
    request_params: dict,
    payload: object,
    period_mode: str | None,
    week_start: date | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into raw.api_payloads (
                load_id,
                account_id,
                source,
                fetched_at,
                request_params,
                payload,
                payload_hash,
                period_mode,
                week_start
            )
            values (%s, %s, %s, now(), %s::jsonb, %s::jsonb, %s, %s, %s)
            """,
            (
                load_id,
                account_id,
                source,
                json.dumps(request_params, ensure_ascii=False),
                json.dumps(payload, ensure_ascii=False),
                canonical_payload_hash(payload),
                period_mode,
                week_start,
            ),
        )
