from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends
import psycopg

from backend.app.modules.auth.deps import get_current_user
from backend.app.db import db_connection
from backend.app.modules.sync.executor import SyncExecutor
from backend.app.modules.sync.schemas import (
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
    SyncDataset,
    SyncJobRunRequest,
    SyncJobType,
)
from backend.app.modules.sync.service import SyncService

router = APIRouter()


def run_sync_job_in_background(job_id: UUID, dataset: str | None = None) -> None:
    SyncExecutor().execute_job_until_done(job_id=job_id, dataset=dataset)


@router.post('/jobs', response_model=SyncJobCreateResponse)
def create_sync_job(
    payload: SyncJobCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    response = SyncService(conn).create_job(payload, user_id=current_user['user_id'])
    background_dataset = (
        SyncDataset.SALES_FUNNEL.value
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
        else SyncDataset.WAREHOUSE_REMAINS.value if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH else None
    )
    background_tasks.add_task(run_sync_job_in_background, response.job_id, background_dataset)
    return response


@router.post('/jobs/continue', response_model=SyncJobCreateResponse)
def continue_sync_job(
    payload: SyncJobCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    response = SyncService(conn).continue_job(payload, user_id=current_user['user_id'])
    background_dataset = (
        SyncDataset.SALES_FUNNEL.value
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
        else SyncDataset.WAREHOUSE_REMAINS.value if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH else None
    )
    background_tasks.add_task(run_sync_job_in_background, response.job_id, background_dataset)
    return response


@router.get('/jobs/{job_id}', response_model=SyncJobDetailsResponse)
def get_sync_job(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    return SyncService(conn).get_job_details(job_id, user_id=current_user['user_id'])


@router.post('/jobs/{job_id}/resume-ready', response_model=SyncJobDetailsResponse)
def resume_ready_sync_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    service = SyncService(conn)
    if service.should_resume_job(job_id, user_id=current_user['user_id']):
        job_details = service.get_job_details(job_id, user_id=current_user['user_id'])
        background_dataset = (
            SyncDataset.SALES_FUNNEL.value
            if job_details.job.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
            else SyncDataset.WAREHOUSE_REMAINS.value if job_details.job.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH else None
        )
        background_tasks.add_task(run_sync_job_in_background, job_id, background_dataset)
    return service.get_job_details(job_id, user_id=current_user['user_id'])


@router.post('/jobs/{job_id}/run', response_model=SyncJobDetailsResponse)
def run_sync_job(
    job_id: UUID,
    payload: SyncJobRunRequest,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    return SyncService(conn).run_job(job_id, user_id=current_user['user_id'], max_steps=payload.max_steps)


@router.post('/jobs/{job_id}/cancel', response_model=SyncJobDetailsResponse)
def cancel_sync_job(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    return SyncService(conn).cancel_job(job_id, user_id=current_user['user_id'])


@router.post('/jobs/{job_id}/restart', response_model=SyncJobCreateResponse)
def restart_sync_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    response = SyncService(conn).restart_job(job_id, user_id=current_user['user_id'])
    job_details = SyncService(conn).get_job_details(response.job_id, user_id=current_user['user_id'])
    background_dataset = (
        SyncDataset.SALES_FUNNEL.value
        if job_details.job.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
        else SyncDataset.WAREHOUSE_REMAINS.value if job_details.job.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH else None
    )
    background_tasks.add_task(run_sync_job_in_background, response.job_id, background_dataset)
    return response


@router.post('/jobs/{job_id}/retry-failed', response_model=SyncJobDetailsResponse)
def retry_failed_sync_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    response = SyncService(conn).retry_failed_steps(job_id, user_id=current_user['user_id'])
    job_details = SyncService(conn).get_job_details(job_id, user_id=current_user['user_id'])
    background_dataset = (
        SyncDataset.SALES_FUNNEL.value
        if job_details.job.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
        else SyncDataset.WAREHOUSE_REMAINS.value if job_details.job.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH else None
    )
    background_tasks.add_task(run_sync_job_in_background, job_id, background_dataset)
    return response
