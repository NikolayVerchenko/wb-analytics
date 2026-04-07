from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.accounts.access import AccountAccessRepository
from backend.app.modules.stocks.repository import StocksRepository


class StocksService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = StocksRepository(conn)
        self._account_access = AccountAccessRepository(conn)

    def _ensure_account_access(self, *, user_id: UUID, account_id: UUID) -> None:
        if not self._account_access.user_has_account_access(user_id=user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    def list_items(
        self,
        user_id: UUID,
        account_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> dict:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        items, totals = self._repository.list_items(account_id, search, limit, offset)
        return {
            'items': items,
            'totals': totals,
        }

    def list_warehouses(
        self,
        user_id: UUID,
        account_id: UUID,
        nm_id: int,
        vendor_code: str,
        tech_size: str,
    ) -> list[dict]:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        return self._repository.list_warehouses(account_id, nm_id, vendor_code, tech_size)
