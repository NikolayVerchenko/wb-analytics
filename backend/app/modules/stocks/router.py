from uuid import UUID

from fastapi import APIRouter, Depends, Query
import psycopg

from backend.app.db import db_connection
from backend.app.modules.auth.deps import get_current_user
from backend.app.modules.stocks.schemas import (
    StockSnapshotItemsResponse,
    StockWarehouseRead,
)
from backend.app.modules.stocks.service import StocksService

router = APIRouter()


@router.get('/items', response_model=StockSnapshotItemsResponse)
def list_stock_items(
    account_id: UUID = Query(...),
    search: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> StockSnapshotItemsResponse:
    return StocksService(conn).list_items(current_user['user_id'], account_id, search, limit, offset)


@router.get('/warehouses', response_model=list[StockWarehouseRead])
def list_stock_warehouses(
    account_id: UUID = Query(...),
    nm_id: int = Query(...),
    vendor_code: str = Query(...),
    tech_size: str = Query(...),
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[StockWarehouseRead]:
    return StocksService(conn).list_warehouses(current_user['user_id'], account_id, nm_id, vendor_code, tech_size)
