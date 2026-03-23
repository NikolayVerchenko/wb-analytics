from datetime import date
from uuid import UUID

import psycopg


def get_latest_success_load_id(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    source: str,
    period_from: date | None = None,
    period_to: date | None = None,
    period_mode: str | None = None,
    week_start: date | None = None,
) -> UUID:
    clauses = [
        "account_id = %s",
        "source = %s",
        "status = 'success'",
    ]
    params: list[object] = [account_id, source]

    if period_from is not None:
        clauses.append("period_from = %s")
        params.append(period_from)
    if period_to is not None:
        clauses.append("period_to = %s")
        params.append(period_to)
    if period_mode is not None:
        clauses.append("period_mode = %s")
        params.append(period_mode)
    if week_start is not None:
        clauses.append("week_start = %s")
        params.append(week_start)

    where_sql = "\n              and ".join(clauses)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            select load_id
            from raw.load_runs
            where {where_sql}
            order by fetched_at desc
            limit 1
            """,
            tuple(params),
        )
        row = cur.fetchone()

    if not row:
        raise RuntimeError("No successful raw load found for the requested parameters")

    return row[0]


def fetch_payload_pages(conn: psycopg.Connection, load_id: UUID) -> list[object]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select payload
            from raw.api_payloads
            where load_id = %s
            order by fetched_at, id
            """,
            (load_id,),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def fetch_payload_rows(conn: psycopg.Connection, load_id: UUID) -> list[tuple[object, dict]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select payload, request_params
            from raw.api_payloads
            where load_id = %s
            order by fetched_at, id
            """,
            (load_id,),
        )
        rows = cur.fetchall()
    return [(row[0], row[1]) for row in rows]


def fetch_latest_payload_pages(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    source: str,
    period_from: date | None = None,
    period_to: date | None = None,
    period_mode: str | None = None,
    week_start: date | None = None,
) -> tuple[UUID, list[object]]:
    load_id = get_latest_success_load_id(
        conn,
        account_id=account_id,
        source=source,
        period_from=period_from,
        period_to=period_to,
        period_mode=period_mode,
        week_start=week_start,
    )
    return load_id, fetch_payload_pages(conn, load_id)


def fetch_latest_payload_rows(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    source: str,
    period_from: date | None = None,
    period_to: date | None = None,
    period_mode: str | None = None,
    week_start: date | None = None,
) -> tuple[UUID, list[tuple[object, dict]]]:
    load_id = get_latest_success_load_id(
        conn,
        account_id=account_id,
        source=source,
        period_from=period_from,
        period_to=period_to,
        period_mode=period_mode,
        week_start=week_start,
    )
    return load_id, fetch_payload_rows(conn, load_id)


def fetch_latest_single_payload(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    source: str,
    period_from: date | None = None,
    period_to: date | None = None,
    period_mode: str | None = None,
    week_start: date | None = None,
) -> tuple[UUID, object]:
    load_id, payload_pages = fetch_latest_payload_pages(
        conn,
        account_id=account_id,
        source=source,
        period_from=period_from,
        period_to=period_to,
        period_mode=period_mode,
        week_start=week_start,
    )
    if not payload_pages:
        raise RuntimeError("No raw payload rows found for the latest successful load")
    return load_id, payload_pages[-1]
