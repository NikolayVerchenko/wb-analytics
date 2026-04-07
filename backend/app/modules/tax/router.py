from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.modules.auth.deps import get_current_user
from backend.app.db import db_connection
from backend.app.modules.tax.schemas import TaxSettingsRead, TaxSettingsUpsert
from backend.app.modules.tax.service import TaxService

router = APIRouter()


@router.get('/{account_id}', response_model=TaxSettingsRead)
def get_tax_settings(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> TaxSettingsRead:
    return TaxService(conn).get_tax_settings(current_user['user_id'], account_id)


@router.put('/{account_id}', response_model=TaxSettingsRead)
def upsert_tax_settings(
    account_id: UUID,
    payload: TaxSettingsUpsert,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> TaxSettingsRead:
    return TaxService(conn).upsert_tax_settings(current_user['user_id'], account_id, payload)
