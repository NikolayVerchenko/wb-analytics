import time
import asyncio
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.app.db import get_async_db_pool
from backend.app.modules.auth.deps import get_current_principal
from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.modules.economics.schemas import (
    EconomicsAdvertDiagnosticsResponse,
    EconomicsDashboardResponse,
    EconomicsFilterOptionsResponse,
    EconomicsPeriodItemsResponse,
    EconomicsPeriodSizeRead,
)
from backend.app.modules.economics.service import EconomicsService

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

@router.get('/period-items', response_model=EconomicsPeriodItemsResponse)
async def list_period_items(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    search: str | None = Query(None),
    subjects: list[str] | None = Query(None),
    brands: list[str] | None = Query(None),
    articles: list[str] | None = Query(None),
    sort: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    only_negative_profit: bool = Query(False),
    min_profit: Decimal | None = Query(None),
    max_profit: Decimal | None = Query(None),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> EconomicsPeriodItemsResponse:
    cache_key = (
        'period_items', account_id, date_from, date_to, search,
        tuple(subjects) if subjects else None, tuple(brands) if brands else None, tuple(articles) if articles else None,
        sort, limit, offset, only_negative_profit, min_profit, max_profit
    )
    
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await EconomicsService(conn).list_period_items(
                principal, account_id, date_from, date_to, search, subjects, brands, articles, sort, limit, offset, only_negative_profit, min_profit, max_profit
            )
            
    return await _get_cached(cache_key, 60, fetch)


@router.get('/period-sizes', response_model=list[EconomicsPeriodSizeRead])
async def list_period_sizes(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    nm_id: int = Query(...),
    vendor_code: str = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> list[EconomicsPeriodSizeRead]:
    async with get_async_db_pool().connection() as conn:
        return await EconomicsService(conn).list_period_sizes(principal, account_id, date_from, date_to, nm_id, vendor_code)


@router.get('/filter-options', response_model=EconomicsFilterOptionsResponse)
async def list_filter_options(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> EconomicsFilterOptionsResponse:
    cache_key = ('filter_options', account_id, date_from, date_to)
    
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await EconomicsService(conn).list_filter_options(principal, account_id, date_from, date_to)
            
    return await _get_cached(cache_key, 3600, fetch)


@router.get('/dashboard', response_model=EconomicsDashboardResponse)
async def get_dashboard(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    subjects: list[str] | None = Query(None),
    brands: list[str] | None = Query(None),
    articles: list[str] | None = Query(None),
    compare_previous: bool = Query(True),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> EconomicsDashboardResponse:
    cache_key = (
        'dashboard', account_id, date_from, date_to,
        tuple(subjects) if subjects else None, tuple(brands) if brands else None, tuple(articles) if articles else None,
        compare_previous
    )
    
    async def fetch():
        async with get_async_db_pool().connection() as conn:
            return await EconomicsService(conn).get_dashboard(
                principal=principal, account_id=account_id, date_from=date_from, date_to=date_to, subjects=subjects, brands=brands, articles=articles, compare_previous=compare_previous
            )
            
    return await _get_cached(cache_key, 300, fetch)


@router.get('/advert-diagnostics', response_model=EconomicsAdvertDiagnosticsResponse)
async def get_advert_diagnostics(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    principal: AccessTokenPayload = Depends(get_current_principal),
) -> EconomicsAdvertDiagnosticsResponse:
    async with get_async_db_pool().connection() as conn:
        return await EconomicsService(conn).get_advert_diagnostics(
            principal=principal, account_id=account_id, date_from=date_from, date_to=date_to
        )
