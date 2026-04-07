from uuid import UUID

import psycopg


class AccountAccessRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def user_has_account_access(self, *, user_id: UUID, account_id: UUID) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select exists(
                    select 1
                    from core.user_accounts
                    where user_id = %s
                      and account_id = %s
                ) as has_access
                """,
                (user_id, account_id),
            )
            row = cur.fetchone()
        return bool(row['has_access']) if row is not None else False
