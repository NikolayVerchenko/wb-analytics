from datetime import date, datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SyncJobType(str, Enum):
    INITIAL_SALES_BACKFILL = "initial_sales_backfill"
    SALES_FUNNEL_BACKFILL = "sales_funnel_backfill"
    STOCK_SNAPSHOT_REFRESH = "stock_snapshot_refresh"
    OPEN_WEEK_REFRESH = "open_week_refresh"
    HISTORY_GAP_FILL = "history_gap_fill"


class SyncMode(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"


class SyncDataset(str, Enum):
    SALES = "sales"
    CARDS = "cards"
    ADVERTS_SNAPSHOT = "adverts_snapshot"
    ADVERTS_COST = "adverts_cost"
    ACCEPTANCE = "acceptance"
    STORAGE = "storage"
    SALES_FUNNEL = "sales_funnel"
    WAREHOUSE_REMAINS = "warehouse_remains"
    SUPPLIES = "supplies"


class SyncJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SyncJobStepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class SyncCoverageSectionStatus(str, Enum):
    ACTUAL = "actual"
    PARTIAL = "partial"
    STALE = "stale"
    LOADING = "loading"
    ERROR = "error"
    EMPTY = "empty"


class SyncJobCreate(BaseModel):
    account_id: UUID
    job_type: SyncJobType
    mode: SyncMode
    date_from: date
    date_to: date
    datasets: list[SyncDataset]


class SyncJobRunRequest(BaseModel):
    max_steps: int = Field(default=1, ge=1, le=20)


class SyncJobStepRead(BaseModel):
    step_id: UUID
    job_id: UUID
    dataset: SyncDataset
    period_from: date
    period_to: date
    status: SyncJobStepStatus
    attempt: int
    error_message: str | None = None
    payload_json: dict | None = None
    next_retry_at: datetime | None = None
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


class SyncHistoryGapFillRequest(BaseModel):
    account_id: UUID
    datasets: list[SyncDataset]


class SyncHistoryGapFillResponse(BaseModel):
    job_id: UUID | None = None
    status: Literal['pending', 'noop']
    message: str | None = None
    datasets: list[SyncDataset] = Field(default_factory=list)
    planned_steps: int = 0


class SyncJobDetailsResponse(BaseModel):
    job: SyncJobRead
    steps: list[SyncJobStepRead]


class DateRangeRead(BaseModel):
    date_from: date
    date_to: date


class SyncCoverageDatasetRead(BaseModel):
    dataset: str
    label: str
    loaded_from: date | None = None
    loaded_to: date | None = None
    actual_at: datetime | None = None
    last_success_at: datetime | None = None
    entity_count: int | None = None
    has_gaps: bool = False
    missing_periods: list[DateRangeRead] = Field(default_factory=list)
    status: SyncCoverageSectionStatus
    comment: str | None = None


class SyncCoverageSectionRead(BaseModel):
    status: SyncCoverageSectionStatus
    datasets: list[SyncCoverageDatasetRead]


class SyncCoverageActiveJobRead(BaseModel):
    job_id: UUID
    job_type: SyncJobType
    mode: SyncMode
    status: SyncJobStatus


class SyncCoverageResponse(BaseModel):
    account_id: UUID
    historical: SyncCoverageSectionRead
    operational: SyncCoverageSectionRead
    reference_data: SyncCoverageSectionRead
    active_jobs: list[SyncCoverageActiveJobRead] = Field(default_factory=list)
