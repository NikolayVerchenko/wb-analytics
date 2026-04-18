from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.modules.stocks.repository import StocksRepository


class StocksService:
    def __init__(self, conn: psycopg.AsyncConnection) -> None:
        self._repository = StocksRepository(conn)

    async def _ensure_account_access(self, *, principal: AccessTokenPayload, account_id: UUID) -> None:
        if not await self._repository.user_has_account_access(user_id=principal.user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    async def list_items(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> dict:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        items, totals = await self._repository.list_items(account_id, search, limit, offset)
        return {
            'items': items,
            'totals': totals,
        }

    async def list_warehouses(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        nm_id: int,
        vendor_code: str,
        tech_size: str,
    ) -> list[dict]:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        return await self._repository.list_warehouses(account_id, nm_id, vendor_code, tech_size)
