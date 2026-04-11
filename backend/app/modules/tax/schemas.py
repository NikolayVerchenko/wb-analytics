from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TaxSettingsRead(BaseModel):
    account_id: UUID
    tax_rate_percent: Decimal | None = None
    tax_base: str
    effective_from: date | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TaxSettingsUpsert(BaseModel):
    tax_rate_percent: Decimal = Field(gt=0, le=100)
    effective_from: date | None = None
