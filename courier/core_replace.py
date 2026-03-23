from datetime import date
from uuid import UUID

import psycopg


def replace_account_snapshot(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    table_names: list[str] | tuple[str, ...],
) -> None:
    with conn.cursor() as cur:
        for table_name in table_names:
            cur.execute(
                f"delete from {table_name} where account_id = %s",
                (account_id,),
            )


def replace_account_period_by_date_column(
    conn: psycopg.Connection,
    *,
    table_name: str,
    date_column: str,
    account_id: UUID,
    date_from: date,
    date_to: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            delete from {table_name}
            where account_id = %s
              and {date_column} >= %s
              and {date_column} <= %s
            """,
            (account_id, date_from, date_to),
        )


def replace_account_period_by_date_expression(
    conn: psycopg.Connection,
    *,
    table_name: str,
    date_expression: str,
    account_id: UUID,
    date_from: date,
    date_to: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            delete from {table_name}
            where account_id = %s
              and {date_expression} between %s and %s
            """,
            (account_id, date_from, date_to),
        )


def replace_account_exact_period(
    conn: psycopg.Connection,
    *,
    table_name: str,
    account_id: UUID,
    period_from_column: str,
    period_to_column: str,
    period_from: date,
    period_to: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            delete from {table_name}
            where account_id = %s
              and {period_from_column} = %s
              and {period_to_column} = %s
            """,
            (account_id, period_from, period_to),
        )
