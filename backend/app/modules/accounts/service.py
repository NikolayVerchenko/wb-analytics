from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.accounts.repository import AccountsRepository
from backend.app.modules.accounts.schemas import AccountRead


class AccountsService:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._repository = AccountsRepository(conn)

    def list_accounts(self) -> list[AccountRead]:
        rows = self._repository.list_accounts()
        return [AccountRead.model_validate(row) for row in rows]

    def get_account(self, account_id: UUID) -> AccountRead:
        row = self._repository.get_account(account_id)
        if row is None:
            raise HTTPException(status_code=404, detail='Account not found')
        return AccountRead.model_validate(row)
