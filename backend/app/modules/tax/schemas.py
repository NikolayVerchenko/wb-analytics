from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TaxSettingsRead(BaseModel):
    account_id: UUID
    tax_rate_percent: Decimal
    tax_base: str
    effective_from: date
    created_at: datetime
    updated_at: datetime


class TaxSettingsUpsert(BaseModel):
    tax_rate_percent: Decimal = Field(gt=0, le=100)
    effective_from: date | None = None
