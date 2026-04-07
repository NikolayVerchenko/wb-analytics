from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class StockSnapshotItemRead(BaseModel):
    account_id: UUID
    nm_id: int
    vendor_code: str | None
    tech_size: str | None
    brand_name: str | None
    subject_name: str | None
    photo_url: str | None
    snapshot_loaded_at: datetime | None
    total_on_warehouses: Decimal | None
    in_transit_to_customer: Decimal | None
    in_transit_from_customer: Decimal | None
    total_stock: Decimal | None
    cogs_per_unit: Decimal | None
    stock_cogs_total: Decimal | None


class StockSnapshotTotalsRead(BaseModel):
    snapshot_loaded_at: datetime | None
    total_on_warehouses: Decimal | None
    in_transit_to_customer: Decimal | None
    in_transit_from_customer: Decimal | None
    total_stock: Decimal | None
    cogs_per_unit: Decimal | None
    stock_cogs_total: Decimal | None


class StockSnapshotItemsResponse(BaseModel):
    items: list[StockSnapshotItemRead]
    totals: StockSnapshotTotalsRead


class StockWarehouseRead(BaseModel):
    warehouse_name: str
    snapshot_loaded_at: datetime | None
    quantity: Decimal | None
