from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class SupplyRead(BaseModel):
    account_id: UUID
    supply_id: int
    preorder_id: int | None
    status_id: int | None
    create_date: datetime | None
    supply_date: datetime | None
    fact_date: datetime | None
    updated_date: datetime | None
    items_count: int
    planned_quantity: int
    accepted_quantity_total: int


class SupplyItemRead(BaseModel):
    account_id: UUID
    supply_id: int
    preorder_id: int | None
    supply_target_id: int
    is_preorder_id: bool
    status_id: int | None
    create_date: datetime | None
    supply_date: datetime | None
    fact_date: datetime | None
    updated_date: datetime | None
    nm_id: int
    vendor_code: str
    tech_size: str | None
    barcode: str | None
    color: str | None
    need_kiz: bool | None
    tnved: str | None
    supplier_box_amount: int | None
    quantity: int | None
    ready_for_sale_quantity: int | None
    unloading_quantity: int | None
    accepted_quantity: int | None
    photo_url: str | None
    unit_cogs: Decimal | None


class SupplyItemCostUpsert(BaseModel):
    nm_id: int
    vendor_code: str
    tech_size: str | None = None
    barcode: str | None = None
    unit_cogs: Decimal = Field(gt=0)


class SupplyArticleCostUpsert(BaseModel):
    nm_id: int
    vendor_code: str
    unit_cogs: Decimal = Field(gt=0)
