from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.db import db_connection
from backend.app.modules.auth.deps import get_current_user
from backend.app.modules.sync.schemas import (
    SyncCoverageResponse,
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
    SyncJobRunRequest,
)
from backend.app.modules.sync.service import SyncService

router = APIRouter()


@router.get('/coverage', response_model=SyncCoverageResponse)
def get_sync_coverage(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncCoverageResponse:
    return SyncService(conn).get_account_coverage(account_id, user_id=current_user['user_id'])


@router.post('/jobs', response_model=SyncJobCreateResponse)
def create_sync_job(
    payload: SyncJobCreate,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    return SyncService(conn).create_job(payload, user_id=current_user['user_id'])


@router.post('/jobs/continue', response_model=SyncJobCreateResponse)
def continue_sync_job(
    payload: SyncJobCreate,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    return SyncService(conn).continue_job(payload, user_id=current_user['user_id'])


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
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    service = SyncService(conn)
    service.should_resume_job(job_id, user_id=current_user['user_id'])
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
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    return SyncService(conn).restart_job(job_id, user_id=current_user['user_id'])


@router.post('/jobs/{job_id}/retry-failed', response_model=SyncJobDetailsResponse)
def retry_failed_sync_job(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    return SyncService(conn).retry_failed_steps(job_id, user_id=current_user['user_id'])
