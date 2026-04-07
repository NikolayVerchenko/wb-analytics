from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.accounts.repository import AccountsRepository
from backend.app.modules.accounts.schemas import (
    AccountConnectRequest,
    AccountConnectResponse,
    AccountRead,
)
from backend.app.modules.accounts.wb_client import AccountConnectError, WbAccountClient


class AccountsService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = AccountsRepository(conn)
        self._wb_client = WbAccountClient()

    def list_accounts(self, *, user_id: UUID) -> list[AccountRead]:
        rows = self._repository.list_accounts(user_id=user_id)
        return [AccountRead.model_validate(row) for row in rows]

    def get_account(self, account_id: UUID, *, user_id: UUID) -> AccountRead:
        row = self._repository.get_account(account_id, user_id=user_id)
        if row is None:
            raise HTTPException(status_code=404, detail='Account not found')
        return AccountRead.model_validate(row)

    def grant_account_access(self, *, user_id: UUID, account_id: UUID, role: str = 'member') -> dict:
        if role not in {'owner', 'member'}:
            raise HTTPException(status_code=400, detail='Invalid account role')
        return self._repository.grant_account_access(user_id=user_id, account_id=account_id, role=role)

    def connect_own_account(self, *, user_id: UUID, payload: AccountConnectRequest) -> AccountConnectResponse:
        token = payload.token.strip()
        if not token:
            raise HTTPException(status_code=400, detail='WB токен обязателен.')

        try:
            seller_profile = self._wb_client.fetch_seller_profile(token)
        except AccountConnectError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        account_name = self._resolve_account_name(payload.name, seller_profile.seller_name, seller_profile.wb_seller_id)
        existing_account = self._repository.find_account_by_wb_seller_id(seller_profile.wb_seller_id)

        if existing_account is None:
            account_row = self._repository.create_account(name=account_name, wb_token=token, status='active')
            created = True
        else:
            account_row = self._repository.update_account(
                account_id=existing_account['account_id'],
                name=account_name,
                wb_token=token,
                status='active',
            )
            created = False

        account_id = account_row['account_id']
        self._repository.upsert_seller_info(
            account_id=account_id,
            wb_seller_id=seller_profile.wb_seller_id,
            seller_name=seller_profile.seller_name,
            trade_mark=seller_profile.trade_mark,
        )
        self._repository.grant_account_access(user_id=user_id, account_id=account_id, role='owner')

        account = self.get_account(account_id, user_id=user_id)
        return AccountConnectResponse(account=account, role='owner', created=created)

    @staticmethod
    def _resolve_account_name(
        requested_name: str | None,
        seller_name: str | None,
        wb_seller_id: str,
    ) -> str:
        if requested_name and requested_name.strip():
            return requested_name.strip()
        if seller_name and seller_name.strip():
            return seller_name.strip()
        return f'WB кабинет {wb_seller_id}'
