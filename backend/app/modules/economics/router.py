from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
import psycopg

from backend.app.db import db_connection
from backend.app.modules.auth.deps import get_current_user
from backend.app.modules.economics.schemas import (
    EconomicsAdvertDiagnosticsResponse,
    EconomicsDashboardResponse,
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
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsPeriodItemsResponse:
    return EconomicsService(conn).list_period_items(
        current_user['user_id'],
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
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[EconomicsPeriodSizeRead]:
    return EconomicsService(conn).list_period_sizes(current_user['user_id'], account_id, date_from, date_to, nm_id, vendor_code)


@router.get('/filter-options', response_model=EconomicsFilterOptionsResponse)
def list_filter_options(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsFilterOptionsResponse:
    return EconomicsService(conn).list_filter_options(current_user['user_id'], account_id, date_from, date_to)


@router.get('/dashboard', response_model=EconomicsDashboardResponse)
def get_dashboard(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    subjects: list[str] | None = Query(None),
    brands: list[str] | None = Query(None),
    articles: list[str] | None = Query(None),
    compare_previous: bool = Query(True),
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsDashboardResponse:
    return EconomicsService(conn).get_dashboard(
        user_id=current_user['user_id'],
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        subjects=subjects,
        brands=brands,
        articles=articles,
        compare_previous=compare_previous,
    )


@router.get('/advert-diagnostics', response_model=EconomicsAdvertDiagnosticsResponse)
def get_advert_diagnostics(
    account_id: UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> EconomicsAdvertDiagnosticsResponse:
    return EconomicsService(conn).get_advert_diagnostics(
        user_id=current_user['user_id'],
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
    )
