from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AccountRead(BaseModel):
    account_id: UUID
    name: str | None
    status: str | None
    created_at: datetime | None
    wb_seller_id: str | None
    seller_name: str | None
    trade_mark: str | None
