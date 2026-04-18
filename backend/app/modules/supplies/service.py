from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.marts_refresh import trigger_marts_refresh_background
from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.modules.supplies.repository import SuppliesRepository
from backend.app.modules.supplies.schemas import SupplyArticleCostUpsert, SupplyItemCostUpsert, SupplyItemRead, SupplyRead


class SuppliesService:
    def __init__(self, conn: psycopg.AsyncConnection) -> None:
        self._repository = SuppliesRepository(conn)

    async def _ensure_account_access(self, *, principal: AccessTokenPayload, account_id: UUID) -> None:
        if not await self._repository.user_has_account_access(user_id=principal.user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    async def list_supplies(self, principal: AccessTokenPayload, account_id: UUID) -> list[SupplyRead]:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        rows = await self._repository.list_supplies(account_id)
        return [SupplyRead.model_validate(row) for row in rows]

    async def list_supply_items(self, principal: AccessTokenPayload, account_id: UUID, supply_id: int) -> list[SupplyItemRead]:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        rows = await self._repository.list_supply_items(account_id, supply_id)
        return [SupplyItemRead.model_validate(row) for row in rows]

    async def upsert_supply_item_cost(self, principal: AccessTokenPayload, account_id: UUID, supply_id: int, payload: SupplyItemCostUpsert) -> None:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        await self._repository.upsert_supply_item_cost(
            account_id=account_id,
            supply_id=supply_id,
            nm_id=payload.nm_id,
            vendor_code=payload.vendor_code,
            tech_size=payload.tech_size,
            barcode=payload.barcode,
            unit_cogs=payload.unit_cogs,
        )

    async def upsert_supply_article_cost_for_all_sizes(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        supply_id: int,
        payload: SupplyArticleCostUpsert,
    ) -> int:
        await self._ensure_account_access(principal=principal, account_id=account_id)
        return await self._repository.upsert_supply_article_cost_for_all_sizes(
            account_id=account_id,
            supply_id=supply_id,
            nm_id=payload.nm_id,
            vendor_code=payload.vendor_code,
            unit_cogs=payload.unit_cogs,
        )

    def trigger_marts_refresh(self) -> None:
        trigger_marts_refresh_background()
