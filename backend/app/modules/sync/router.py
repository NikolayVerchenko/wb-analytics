from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.db import db_connection
from backend.app.modules.sync.schemas import (
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
)
from backend.app.modules.sync.service import SyncService

router = APIRouter()


@router.post('/jobs', response_model=SyncJobCreateResponse)
def create_sync_job(
    payload: SyncJobCreate,
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobCreateResponse:
    return SyncService(conn).create_job(payload)


@router.get('/jobs/{job_id}', response_model=SyncJobDetailsResponse)
def get_sync_job(
    job_id: UUID,
    conn: psycopg.Connection = Depends(db_connection),
) -> SyncJobDetailsResponse:
    return SyncService(conn).get_job_details(job_id)
