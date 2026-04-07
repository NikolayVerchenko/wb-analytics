from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import psycopg


class AuthRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get_user_profile(self, user_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    u.user_id,
                    u.name,
                    u.email,
                    u.status,
                    exists(
                        select 1
                        from core.telegram_identities ti
                        where ti.user_id = u.user_id
                    ) as telegram_linked
                from core.users u
                where u.user_id = %s
                """,
                (user_id,),
            )
            return cur.fetchone()

    def get_user_credentials_by_email(self, email: str) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    u.user_id,
                    u.name,
                    u.email,
                    u.password_hash,
                    u.status,
                    exists(
                        select 1
                        from core.telegram_identities ti
                        where ti.user_id = u.user_id
                    ) as telegram_linked
                from core.users u
                where lower(u.email) = lower(%s)
                """,
                (email,),
            )
            return cur.fetchone()

    def create_user(self, *, name: str, email: str, password_hash: str) -> dict:
        user_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.users (
                    user_id,
                    email,
                    password_hash,
                    name,
                    status,
                    created_at,
                    updated_at
                )
                values (%s, %s, %s, %s, 'active', %s, %s)
                returning user_id
                """,
                (user_id, email, password_hash, name, now, now),
            )
            return cur.fetchone()

    def update_user_password(self, user_id: UUID, password_hash: str) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.users
                set password_hash = %s,
                    updated_at = %s
                where user_id = %s
                """,
                (password_hash, now, user_id),
            )

    def get_session_by_hash(self, refresh_token_hash: str) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select id, user_id, refresh_token_hash, expires_at, created_at, revoked_at
                from core.auth_sessions
                where refresh_token_hash = %s
                """,
                (refresh_token_hash,),
            )
            return cur.fetchone()

    def create_session(self, user_id: UUID, refresh_token_hash: str, expires_at: datetime) -> dict:
        session_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.auth_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
                values (%s, %s, %s, %s, %s)
                returning id, user_id
                """,
                (session_id, user_id, refresh_token_hash, expires_at, now),
            )
            return cur.fetchone()

    def revoke_session_by_id(self, session_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.auth_sessions
                set revoked_at = %s
                where id = %s and revoked_at is null
                """,
                (now, session_id),
            )

    def revoke_session_by_hash(self, refresh_token_hash: str) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.auth_sessions
                set revoked_at = %s
                where refresh_token_hash = %s and revoked_at is null
                """,
                (now, refresh_token_hash),
            )

    def revoke_all_sessions_for_user(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.auth_sessions
                set revoked_at = %s
                where user_id = %s and revoked_at is null
                """,
                (now, user_id),
            )

    def create_password_reset_token(self, user_id: UUID, token_hash: str, expires_at: datetime) -> dict:
        reset_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
                values (%s, %s, %s, %s, %s)
                returning id, user_id, token_hash, expires_at, used_at, created_at
                """,
                (reset_id, user_id, token_hash, expires_at, now),
            )
            return cur.fetchone()

    def get_password_reset_token_by_hash(self, token_hash: str) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select id, user_id, token_hash, expires_at, used_at, created_at
                from core.password_reset_tokens
                where token_hash = %s
                """,
                (token_hash,),
            )
            return cur.fetchone()

    def mark_password_reset_token_used(self, reset_token_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.password_reset_tokens
                set used_at = %s
                where id = %s and used_at is null
                """,
                (now, reset_token_id),
            )

    def revoke_active_password_reset_tokens_for_user(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.password_reset_tokens
                set used_at = %s
                where user_id = %s and used_at is null
                """,
                (now, user_id),
            )
