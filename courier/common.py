from datetime import date, timedelta
import os
from uuid import UUID

import psycopg
from dotenv import load_dotenv


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Invalid date: {value}") from exc


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def db_connection() -> psycopg.Connection:
    load_dotenv(".env.courier")
    return psycopg.connect(
        host=os.getenv("PGHOST"),
        port=os.getenv("PGPORT"),
        dbname=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
    )


def get_token(conn: psycopg.Connection, account_id: UUID) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            select wb_token
            from core.accounts
            where account_id = %s
            """,
            (account_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Account not found: {account_id}")
    token = row[0]
    if not token or not token.strip():
        raise RuntimeError(f"Empty wb_token for account_id={account_id}")
    return token.strip()
