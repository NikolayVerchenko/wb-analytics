from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.db import db_connection
from backend.app.modules.accounts.schemas import AccountRead
from backend.app.modules.accounts.service import AccountsService

router = APIRouter()


@router.get('', response_model=list[AccountRead])
def list_accounts(conn: psycopg.Connection = Depends(db_connection)) -> list[AccountRead]:
    return AccountsService(conn).list_accounts()


@router.get('/{account_id}', response_model=AccountRead)
def get_account(
    account_id: UUID,
    conn: psycopg.Connection = Depends(db_connection),
) -> AccountRead:
    return AccountsService(conn).get_account(account_id)
