import time
import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.app.db import get_async_db_pool
from backend.app.modules.auth.deps import get_current_principal
from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.modules.stocks.schemas import (
    StockSnapshotItemsResponse,
    StockWarehouseRead,
)
from backend.app.modules.stocks.service import StocksService

router = APIRouter()

_CACHE: dict[tuple, tuple[float, any]] = {}
_LOCKS: dict[tuple, asyncio.Lock] = {}
_CACHE_MAX_SIZE = 1000

async def _get_cached(key: tuple, ttl: int, fetch_func):
    now = time.time()
    if key in _CACHE:
        t, data = _CACHE[key]
        if now - t < ttl:
            return data

    lock = _LOCKS.setdefault(key, asyncio.Lock())
    async with lock:
        now = time.time()
        if key in _CACHE:
            t, data = _CACHE[key]
            if now - t < ttl:
                return data
        
        data = await fetch_func()
        
        if len(_CACHE) >= _CACHE_MAX_SIZE:
            _CACHE.clear()
            _LOCKS.clear()
        _CACHE[key] = (now, data)
        return data

@router.get('/items', response_model=StockSnapshotItemsResponse)
async def list_stock_items(
    account_id: UUID = Query(...),
    search: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> StockSnapshotItemsResponse:
    cache_key = ('stocks_items', account_id, search, limit, offset)
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await StocksService(conn).list_items(principal, account_id, search, limit, offset)
    return await _get_cached(cache_key, 60, fetch)


@router.get('/warehouses', response_model=list[StockWarehouseRead])
async def list_stock_warehouses(
    account_id: UUID = Query(...),
    nm_id: int = Query(...),
    vendor_code: str = Query(...),
    tech_size: str = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> list[StockWarehouseRead]:
    cache_key = ('stocks_warehouses', account_id, nm_id, vendor_code, tech_size)
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await StocksService(conn).list_warehouses(principal, account_id, nm_id, vendor_code, tech_size)
    return await _get_cached(cache_key, 300, fetch)
