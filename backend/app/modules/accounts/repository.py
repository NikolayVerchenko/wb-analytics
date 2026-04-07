import uuid
from uuid import UUID

import psycopg


class AccountsRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list_accounts(self, *, user_id: UUID) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    a.account_id,
                    a.name,
                    a.status,
                    a.created_at,
                    s.wb_seller_id,
                    s.seller_name,
                    s.trade_mark
                from core.user_accounts ua
                join core.accounts a
                    on a.account_id = ua.account_id
                left join core.seller_info s
                    on s.account_id = a.account_id
                where ua.user_id = %s
                order by coalesce(s.seller_name, a.name, a.account_id::text)
                """,
                (user_id,),
            )
            return list(cur.fetchall())

    def get_account(self, account_id: UUID, *, user_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    a.account_id,
                    a.name,
                    a.status,
                    a.created_at,
                    s.wb_seller_id,
                    s.seller_name,
                    s.trade_mark
                from core.user_accounts ua
                join core.accounts a
                    on a.account_id = ua.account_id
                left join core.seller_info s
                    on s.account_id = a.account_id
                where ua.user_id = %s
                  and a.account_id = %s
                """,
                (user_id, account_id),
            )
            return cur.fetchone()

    def find_account_by_wb_seller_id(self, wb_seller_id: str) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    a.account_id,
                    a.name,
                    a.wb_token,
                    a.status,
                    a.created_at,
                    s.wb_seller_id,
                    s.seller_name,
                    s.trade_mark
                from core.seller_info s
                join core.accounts a
                  on a.account_id = s.account_id
                where s.wb_seller_id = %s
                """,
                (wb_seller_id,),
            )
            return cur.fetchone()

    def create_account(self, *, name: str, wb_token: str, status: str = 'active') -> dict:
        account_id = uuid.uuid4()
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.accounts (
                    account_id,
                    name,
                    wb_token,
                    status,
                    created_at
                )
                values (%s, %s, %s, %s, now())
                returning
                    account_id,
                    name,
                    wb_token,
                    status,
                    created_at
                """,
                (account_id, name, wb_token, status),
            )
            return cur.fetchone()

    def update_account(self, *, account_id: UUID, name: str, wb_token: str, status: str = 'active') -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.accounts
                set name = %s,
                    wb_token = %s,
                    status = %s
                where account_id = %s
                returning
                    account_id,
                    name,
                    wb_token,
                    status,
                    created_at
                """,
                (name, wb_token, status, account_id),
            )
            return cur.fetchone()

    def upsert_seller_info(
        self,
        *,
        account_id: UUID,
        wb_seller_id: str,
        seller_name: str | None,
        trade_mark: str | None,
    ) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.seller_info (
                    account_id,
                    wb_seller_id,
                    seller_name,
                    trade_mark,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, null, now())
                on conflict (account_id) do update
                set wb_seller_id = excluded.wb_seller_id,
                    seller_name = excluded.seller_name,
                    trade_mark = excluded.trade_mark,
                    loaded_at = now()
                returning
                    account_id,
                    wb_seller_id,
                    seller_name,
                    trade_mark,
                    loaded_at
                """,
                (account_id, wb_seller_id, seller_name, trade_mark),
            )
            return cur.fetchone()

    def grant_account_access(self, *, user_id: UUID, account_id: UUID, role: str) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.user_accounts (
                    user_id,
                    account_id,
                    role,
                    created_at
                )
                values (%s, %s, %s, now())
                on conflict (user_id, account_id)
                do update set role = excluded.role
                returning
                    user_id,
                    account_id,
                    role,
                    created_at
                """,
                (user_id, account_id, role),
            )
            return cur.fetchone()
