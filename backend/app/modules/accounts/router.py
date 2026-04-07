from uuid import UUID

from fastapi import APIRouter, Depends
import psycopg

from backend.app.db import db_connection
from backend.app.modules.auth.deps import get_current_user
from backend.app.modules.accounts.schemas import AccountConnectRequest, AccountConnectResponse, AccountRead
from backend.app.modules.accounts.service import AccountsService

router = APIRouter()


@router.get('', response_model=list[AccountRead])
def list_accounts(
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> list[AccountRead]:
    return AccountsService(conn).list_accounts(user_id=current_user['user_id'])


@router.post('/connect', response_model=AccountConnectResponse)
def connect_account(
    payload: AccountConnectRequest,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> AccountConnectResponse:
    return AccountsService(conn).connect_own_account(user_id=current_user['user_id'], payload=payload)


@router.get('/{account_id}', response_model=AccountRead)
def get_account(
    account_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: psycopg.Connection = Depends(db_connection),
) -> AccountRead:
    return AccountsService(conn).get_account(account_id, user_id=current_user['user_id'])
