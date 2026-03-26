from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
import psycopg

from courier.common import get_week_start
from backend.app.modules.sync.repository import SyncRepository
from backend.app.modules.sync.schemas import (
    SyncDataset,
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
    SyncJobRead,
    SyncJobStatus,
    SyncJobStepRead,
    SyncJobStepStatus,
    SyncJobType,
    SyncMode,
)


class SyncService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn
        self._repository = SyncRepository(conn)

    def create_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        if payload.job_type != SyncJobType.INITIAL_SALES_BACKFILL:
            raise HTTPException(status_code=400, detail="Unsupported job type for MVP")
        if payload.mode != SyncMode.WEEKLY:
            raise HTTPException(status_code=400, detail="MVP supports only weekly mode")
        if payload.datasets != [SyncDataset.SALES]:
            raise HTTPException(status_code=400, detail="MVP supports only the sales dataset")

        weekly_ranges = self._build_closed_week_ranges(payload.date_from, payload.date_to)
        if not weekly_ranges:
            raise HTTPException(status_code=400, detail="No closed full weeks found in the selected period")

        job_id = uuid4()
        job_row = self._repository.create_job(
            job_id=job_id,
            account_id=payload.account_id,
            job_type=payload.job_type.value,
            mode=payload.mode.value,
            date_from=payload.date_from,
            date_to=payload.date_to,
            status=SyncJobStatus.PENDING.value,
            datasets=[dataset.value for dataset in payload.datasets],
        )

        for period_from, period_to in weekly_ranges:
            self._repository.create_step(
                step_id=uuid4(),
                job_id=job_id,
                dataset=SyncDataset.SALES.value,
                period_from=period_from,
                period_to=period_to,
                status=SyncJobStepStatus.PENDING.value,
                payload_json={
                    "job_type": payload.job_type.value,
                    "mode": payload.mode.value,
                },
            )

        self._conn.commit()
        return SyncJobCreateResponse(job_id=job_row["job_id"], status=SyncJobStatus(job_row["status"]))

    def get_job_details(self, job_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail="Sync job not found")

        step_rows = self._repository.list_job_steps(job_id)
        return SyncJobDetailsResponse(
            job=SyncJobRead.model_validate(job_row),
            steps=[SyncJobStepRead.model_validate(row) for row in step_rows],
        )

    def _build_closed_week_ranges(self, date_from: date, date_to: date) -> list[tuple[date, date]]:
        today = date.today()
        current_week_start = get_week_start(today)
        last_closed_day = current_week_start - timedelta(days=1)
        effective_date_to = min(date_to, last_closed_day)
        if date_from > effective_date_to:
            return []

        first_week_start = get_week_start(date_from)
        if first_week_start < date_from:
            first_week_start += timedelta(days=7)

        last_week_start = get_week_start(effective_date_to)
        last_week_end = last_week_start + timedelta(days=6)
        if last_week_end > effective_date_to:
            last_week_start -= timedelta(days=7)

        if first_week_start > last_week_start:
            return []

        ranges: list[tuple[date, date]] = []
        cursor = first_week_start
        while cursor <= last_week_start:
            ranges.append((cursor, cursor + timedelta(days=6)))
            cursor += timedelta(days=7)
        return ranges
