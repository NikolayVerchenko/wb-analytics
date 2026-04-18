import time
import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from backend.app.modules.auth.deps import get_current_principal
from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.db import get_async_db_pool
from backend.app.modules.supplies.schemas import SupplyArticleCostUpsert, SupplyItemCostUpsert, SupplyItemRead, SupplyRead
from backend.app.modules.supplies.service import SuppliesService

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

@router.get('', response_model=list[SupplyRead])
async def list_supplies(
    account_id: UUID = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> list[SupplyRead]:
    cache_key = ('supplies', account_id)
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await SuppliesService(conn).list_supplies(principal, account_id)
    return await _get_cached(cache_key, 60, fetch)


@router.get('/{supply_id}/items', response_model=list[SupplyItemRead])
async def list_supply_items(
    supply_id: int,
    account_id: UUID = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> list[SupplyItemRead]:
    cache_key = ('supply_items', account_id, supply_id)
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await SuppliesService(conn).list_supply_items(principal, account_id, supply_id)
    return await _get_cached(cache_key, 60, fetch)


@router.put('/{supply_id}/items/cost', status_code=status.HTTP_204_NO_CONTENT)
async def upsert_supply_item_cost(
    supply_id: int,
    payload: SupplyItemCostUpsert,
    account_id: UUID = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> Response:
    async with get_async_db_pool().connection() as conn:
        service = SuppliesService(conn)
        await service.upsert_supply_item_cost(principal, account_id, supply_id, payload)
        await conn.commit()
        service.trigger_marts_refresh()
    _CACHE.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put('/{supply_id}/items/cost/all-sizes', status_code=status.HTTP_204_NO_CONTENT)
async def upsert_supply_article_cost_for_all_sizes(
    supply_id: int,
    payload: SupplyArticleCostUpsert,
    account_id: UUID = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> Response:
    async with get_async_db_pool().connection() as conn:
        service = SuppliesService(conn)
        await service.upsert_supply_article_cost_for_all_sizes(principal, account_id, supply_id, payload)
        await conn.commit()
        service.trigger_marts_refresh()
    _CACHE.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
