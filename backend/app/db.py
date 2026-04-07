from collections.abc import Iterator

import psycopg
from backend.app.settings import get_settings



def get_db_connection() -> psycopg.Connection:
    settings = get_settings()
    return psycopg.connect(
        host=settings.pg_host,
        port=settings.pg_port,
        dbname=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
        row_factory=psycopg.rows.dict_row,
    )



def db_connection() -> Iterator[psycopg.Connection]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
