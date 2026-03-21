from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
import psycopg

from backend.app.db import db_connection
from backend.app.modules.supplies.schemas import SupplyArticleCostUpsert, SupplyItemCostUpsert, SupplyItemRead, SupplyRead
from backend.app.modules.supplies.service import SuppliesService

router = APIRouter()


@router.get('', response_model=list[SupplyRead])
def list_supplies(
    account_id: UUID = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[SupplyRead]:
    return SuppliesService(conn).list_supplies(account_id)


@router.get('/{supply_id}/items', response_model=list[SupplyItemRead])
def list_supply_items(
    supply_id: int,
    account_id: UUID = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[SupplyItemRead]:
    return SuppliesService(conn).list_supply_items(account_id, supply_id)


@router.put('/{supply_id}/items/cost', status_code=status.HTTP_204_NO_CONTENT)
def upsert_supply_item_cost(
    supply_id: int,
    payload: SupplyItemCostUpsert,
    account_id: UUID = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> Response:
    SuppliesService(conn).upsert_supply_item_cost(account_id, supply_id, payload)
    conn.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put('/{supply_id}/items/cost/all-sizes', status_code=status.HTTP_204_NO_CONTENT)
def upsert_supply_article_cost_for_all_sizes(
    supply_id: int,
    payload: SupplyArticleCostUpsert,
    account_id: UUID = Query(...),
    conn: psycopg.Connection = Depends(db_connection),
) -> Response:
    SuppliesService(conn).upsert_supply_article_cost_for_all_sizes(account_id, supply_id, payload)
    conn.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
