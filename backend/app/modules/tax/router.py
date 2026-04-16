from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.modules.auth.deps import get_current_principal
from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.db import db_connection
from backend.app.modules.tax.schemas import TaxSettingsRead, TaxSettingsUpsert
from backend.app.modules.tax.service import TaxService

router = APIRouter()


@router.get('/{account_id}', response_model=TaxSettingsRead)
def get_tax_settings(
    account_id: UUID,
    principal: AccessTokenPayload = Depends(get_current_principal),
    conn: psycopg.Connection = Depends(db_connection),
) -> TaxSettingsRead:
    return TaxService(conn).get_tax_settings(principal, account_id)


@router.put('/{account_id}', response_model=TaxSettingsRead)
def upsert_tax_settings(
    account_id: UUID,
    payload: TaxSettingsUpsert,
    principal: AccessTokenPayload = Depends(get_current_principal),
    conn: psycopg.Connection = Depends(db_connection),
) -> TaxSettingsRead:
    service = TaxService(conn)
    response = service.upsert_tax_settings(principal, account_id, payload)
    conn.commit()
    service.trigger_marts_refresh()
    return response
