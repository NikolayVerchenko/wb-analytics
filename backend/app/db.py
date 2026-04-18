from collections.abc import AsyncIterator, Iterator

import psycopg
import psycopg.rows
from psycopg import AsyncClientCursor, ClientCursor
from psycopg_pool import AsyncConnectionPool, ConnectionPool

from backend.app.settings import get_settings

_async_db_pool: AsyncConnectionPool | None = None
_sync_db_pool: ConnectionPool | None = None


def get_db_connection() -> psycopg.Connection:
    settings = get_settings()
    return psycopg.connect(
        host=settings.pg_host,
        port=settings.pg_port,
        dbname=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
        row_factory=psycopg.rows.dict_row,
        cursor_factory=ClientCursor,
        prepare_threshold=None,
    )


def get_sync_db_pool() -> ConnectionPool:
    global _sync_db_pool
    if _sync_db_pool is None:
        settings = get_settings()
        conninfo = (
            f'host={settings.pg_host} '
            f'port={settings.pg_port} '
            f'dbname={settings.pg_database} '
            f'user={settings.pg_user} '
            f'password={settings.pg_password}'
        )
        _sync_db_pool = ConnectionPool(
            conninfo=conninfo,
            min_size=settings.pgpool_min_size,
            max_size=settings.pgpool_max_size,
            timeout=settings.pgpool_timeout_seconds,
            kwargs={
                'row_factory': psycopg.rows.dict_row,
                'cursor_factory': ClientCursor,
                'prepare_threshold': None,
            },
            open=True,
        )
    return _sync_db_pool


def get_async_db_pool() -> AsyncConnectionPool:
    global _async_db_pool
    if _async_db_pool is None:
        settings = get_settings()
        conninfo = (
            f'host={settings.pg_host} '
            f'port={settings.pg_port} '
            f'dbname={settings.pg_database} '
            f'user={settings.pg_user} '
            f'password={settings.pg_password}'
        )
        _async_db_pool = AsyncConnectionPool(
            conninfo=conninfo,
            min_size=settings.pgpool_min_size,
            max_size=settings.pgpool_max_size,
            timeout=settings.pgpool_timeout_seconds,
            kwargs={
                'row_factory': psycopg.rows.dict_row,
                'cursor_factory': AsyncClientCursor,
                'prepare_threshold': None,
            },
            open=False, # Пул должен открываться асинхронно
        )
    return _async_db_pool


async def init_db_pool() -> None:
    get_sync_db_pool()  # Инициализируем синхронный пул
    await get_async_db_pool().open()


async def close_db_pool() -> None:
    global _async_db_pool, _sync_db_pool
    if _async_db_pool is not None:
        await _async_db_pool.close()
        _async_db_pool = None
    if _sync_db_pool is not None:
        _sync_db_pool.close()
        _sync_db_pool = None


def db_connection() -> Iterator[psycopg.Connection]:
    with get_sync_db_pool().connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


async def async_db_connection() -> AsyncIterator[psycopg.AsyncConnection]:
    async with get_async_db_pool().connection() as conn:
        try:
            yield conn
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise
