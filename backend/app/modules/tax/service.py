from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.accounts.access import AccountAccessRepository
from backend.app.modules.tax.repository import TaxRepository
from backend.app.modules.tax.schemas import TaxSettingsRead, TaxSettingsUpsert


class TaxService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = TaxRepository(conn)
        self._account_access = AccountAccessRepository(conn)

    def _ensure_account_access(self, *, user_id: UUID, account_id: UUID) -> None:
        if not self._account_access.user_has_account_access(user_id=user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    def get_tax_settings(self, user_id: UUID, account_id: UUID) -> TaxSettingsRead:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        row = self._repository.get_tax_settings(account_id)
        if row is None:
            raise HTTPException(status_code=404, detail='Tax settings not found')
        return TaxSettingsRead.model_validate(row)

    def upsert_tax_settings(self, user_id: UUID, account_id: UUID, payload: TaxSettingsUpsert) -> TaxSettingsRead:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        row = self._repository.upsert_tax_settings(account_id, payload)
        return TaxSettingsRead.model_validate(row)
