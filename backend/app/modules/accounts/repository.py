from uuid import UUID

import psycopg


class AccountsRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list_accounts(self) -> list[dict]:
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
                from core.accounts a
                left join core.seller_info s
                    on s.account_id = a.account_id
                order by coalesce(s.seller_name, a.name, a.account_id::text)
                """
            )
            return list(cur.fetchall())

    def get_account(self, account_id: UUID) -> dict | None:
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
                from core.accounts a
                left join core.seller_info s
                    on s.account_id = a.account_id
                where a.account_id = %s
                """,
                (account_id,),
            )
            return cur.fetchone()
