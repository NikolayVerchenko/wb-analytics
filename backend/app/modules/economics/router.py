from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
import psycopg

from backend.app.db import db_connection
from backend.app.modules.economics.schemas import (
    EconomicsFilterOptionsResponse,
    EconomicsPeriodItemsResponse,
    EconomicsPeriodSizeRead,
)
from backend.app.modules.economics.service import EconomicsService

router = APIRouter()


@router.get('/period-items', response_model=EconomicsPeriodItemsResponse)
def list_period_items(
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
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsPeriodItemsResponse:
    return EconomicsService(conn).list_period_items(
        account_id,
        date_from,
        date_to,
        search,
        subjects,
        brands,
        articles,
        sort,
        limit,
        offset,
        only_negative_profit,
        min_profit,
        max_profit,
    )


@router.get('/period-sizes', response_model=list[EconomicsPeriodSizeRead])
def list_period_sizes(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    nm_id: int = Query(...),
    vendor_code: str = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[EconomicsPeriodSizeRead]:
    return EconomicsService(conn).list_period_sizes(account_id, date_from, date_to, nm_id, vendor_code)


@router.get('/filter-options', response_model=EconomicsFilterOptionsResponse)
def list_filter_options(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsFilterOptionsResponse:
    return EconomicsService(conn).list_filter_options(account_id, date_from, date_to)
