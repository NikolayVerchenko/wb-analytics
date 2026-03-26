from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class SyncJobType(str, Enum):
    INITIAL_SALES_BACKFILL = "initial_sales_backfill"


class SyncMode(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"


class SyncDataset(str, Enum):
    SALES = "sales"


class SyncJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"


class SyncJobStepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class SyncJobCreate(BaseModel):
    account_id: UUID
    job_type: SyncJobType
    mode: SyncMode
    date_from: date
    date_to: date
    datasets: list[SyncDataset]


class SyncJobStepRead(BaseModel):
    step_id: UUID
    job_id: UUID
    dataset: SyncDataset
    period_from: date
    period_to: date
    status: SyncJobStepStatus
    attempt: int
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class SyncJobRead(BaseModel):
    job_id: UUID
    account_id: UUID
    job_type: SyncJobType
    mode: SyncMode
    date_from: date
    date_to: date
    status: SyncJobStatus
    datasets: list[SyncDataset]
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class SyncJobCreateResponse(BaseModel):
    job_id: UUID
    status: SyncJobStatus


class SyncJobDetailsResponse(BaseModel):
    job: SyncJobRead
    steps: list[SyncJobStepRead]
