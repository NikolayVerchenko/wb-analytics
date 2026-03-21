from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.tax.repository import TaxRepository
from backend.app.modules.tax.schemas import TaxSettingsRead, TaxSettingsUpsert


class TaxService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = TaxRepository(conn)

    def get_tax_settings(self, account_id: UUID) -> TaxSettingsRead:
        row = self._repository.get_tax_settings(account_id)
        if row is None:
            raise HTTPException(status_code=404, detail='Tax settings not found')
        return TaxSettingsRead.model_validate(row)

    def upsert_tax_settings(self, account_id: UUID, payload: TaxSettingsUpsert) -> TaxSettingsRead:
        row = self._repository.upsert_tax_settings(account_id, payload)
        return TaxSettingsRead.model_validate(row)
