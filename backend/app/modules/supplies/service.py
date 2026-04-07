from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.accounts.access import AccountAccessRepository
from backend.app.modules.supplies.repository import SuppliesRepository
from backend.app.modules.supplies.schemas import SupplyArticleCostUpsert, SupplyItemCostUpsert, SupplyItemRead, SupplyRead


class SuppliesService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = SuppliesRepository(conn)
        self._account_access = AccountAccessRepository(conn)

    def _ensure_account_access(self, *, user_id: UUID, account_id: UUID) -> None:
        if not self._account_access.user_has_account_access(user_id=user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    def list_supplies(self, user_id: UUID, account_id: UUID) -> list[SupplyRead]:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        rows = self._repository.list_supplies(account_id)
        return [SupplyRead.model_validate(row) for row in rows]

    def list_supply_items(self, user_id: UUID, account_id: UUID, supply_id: int) -> list[SupplyItemRead]:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        rows = self._repository.list_supply_items(account_id, supply_id)
        return [SupplyItemRead.model_validate(row) for row in rows]

    def upsert_supply_item_cost(self, user_id: UUID, account_id: UUID, supply_id: int, payload: SupplyItemCostUpsert) -> None:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        self._repository.upsert_supply_item_cost(
            account_id=account_id,
            supply_id=supply_id,
            nm_id=payload.nm_id,
            vendor_code=payload.vendor_code,
            tech_size=payload.tech_size,
            barcode=payload.barcode,
            unit_cogs=payload.unit_cogs,
        )

    def upsert_supply_article_cost_for_all_sizes(
        self,
        user_id: UUID,
        account_id: UUID,
        supply_id: int,
        payload: SupplyArticleCostUpsert,
    ) -> int:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        return self._repository.upsert_supply_article_cost_for_all_sizes(
            account_id=account_id,
            supply_id=supply_id,
            nm_id=payload.nm_id,
            vendor_code=payload.vendor_code,
            unit_cogs=payload.unit_cogs,
        )
