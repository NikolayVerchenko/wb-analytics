from uuid import UUID

import psycopg

from backend.app.modules.supplies.repository import SuppliesRepository
from backend.app.modules.supplies.schemas import SupplyArticleCostUpsert, SupplyItemCostUpsert, SupplyItemRead, SupplyRead


class SuppliesService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = SuppliesRepository(conn)

    def list_supplies(self, account_id: UUID) -> list[SupplyRead]:
        rows = self._repository.list_supplies(account_id)
        return [SupplyRead.model_validate(row) for row in rows]

    def list_supply_items(self, account_id: UUID, supply_id: int) -> list[SupplyItemRead]:
        rows = self._repository.list_supply_items(account_id, supply_id)
        return [SupplyItemRead.model_validate(row) for row in rows]

    def upsert_supply_item_cost(self, account_id: UUID, supply_id: int, payload: SupplyItemCostUpsert) -> None:
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
        account_id: UUID,
        supply_id: int,
        payload: SupplyArticleCostUpsert,
    ) -> int:
        return self._repository.upsert_supply_article_cost_for_all_sizes(
            account_id=account_id,
            supply_id=supply_id,
            nm_id=payload.nm_id,
            vendor_code=payload.vendor_code,
            unit_cogs=payload.unit_cogs,
        )
