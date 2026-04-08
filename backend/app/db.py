from collections.abc import Iterator

import psycopg
import psycopg.rows
from psycopg_pool import ConnectionPool

from backend.app.settings import get_settings

_db_pool: ConnectionPool | None = None


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


def get_db_pool() -> ConnectionPool:
    global _db_pool
    if _db_pool is None:
        settings = get_settings()
        conninfo = (
            f'host={settings.pg_host} '
            f'port={settings.pg_port} '
            f'dbname={settings.pg_database} '
            f'user={settings.pg_user} '
            f'password={settings.pg_password}'
        )
        _db_pool = ConnectionPool(
            conninfo=conninfo,
            min_size=settings.pgpool_min_size,
            max_size=settings.pgpool_max_size,
            timeout=settings.pgpool_timeout_seconds,
            kwargs={'row_factory': psycopg.rows.dict_row},
            open=True,
        )
    return _db_pool


def init_db_pool() -> None:
    get_db_pool()


def close_db_pool() -> None:
    global _db_pool
    if _db_pool is not None:
        _db_pool.close()
        _db_pool = None


def db_connection() -> Iterator[psycopg.Connection]:
    with get_db_pool().connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
