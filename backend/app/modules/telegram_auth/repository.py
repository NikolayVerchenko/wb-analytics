from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import psycopg

from .schemas import TelegramAuthPayload


class TelegramAuthRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get_identity_by_telegram_id(self, telegram_user_id: int) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    ti.id as telegram_identity_id,
                    ti.user_id,
                    ti.telegram_user_id,
                    ti.telegram_username,
                    ti.first_name,
                    ti.last_name,
                    ti.photo_url,
                    ti.auth_date,
                    ti.linked_at,
                    ti.last_seen_at,
                    u.name as user_name,
                    u.email,
                    u.status
                from core.telegram_identities ti
                join core.users u on u.user_id = ti.user_id
                where ti.telegram_user_id = %s
                """,
                (telegram_user_id,),
            )
            return cur.fetchone()

    def get_user(self, user_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select user_id, name, email, status
                from core.users
                where user_id = %s
                """,
                (user_id,),
            )
            return cur.fetchone()

    def create_user(self, name: str, email: str, password_hash: str) -> dict:
        user_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.users (user_id, email, password_hash, name, status, created_at, updated_at)
                values (%s, %s, %s, %s, 'active', %s, %s)
                returning user_id, name
                """,
                (user_id, email, password_hash, name, now, now),
            )
            return cur.fetchone()

    def create_identity(self, user_id: UUID, payload: TelegramAuthPayload) -> dict:
        identity_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.telegram_identities (
                    id,
                    user_id,
                    telegram_user_id,
                    telegram_username,
                    first_name,
                    last_name,
                    photo_url,
                    auth_date,
                    linked_at,
                    last_seen_at,
                    is_verified
                )
                values (%s, %s, %s, %s, %s, %s, %s, to_timestamp(%s), %s, %s, true)
                returning id, user_id
                """,
                (
                    identity_id,
                    user_id,
                    payload.id,
                    payload.username,
                    payload.first_name,
                    payload.last_name,
                    payload.photo_url,
                    payload.auth_date,
                    now,
                    now,
                ),
            )
            return cur.fetchone()

    def update_identity_activity(self, identity_id: UUID, payload: TelegramAuthPayload) -> None:
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update core.telegram_identities
                set
                    telegram_username = %s,
                    first_name = %s,
                    last_name = %s,
                    photo_url = %s,
                    auth_date = to_timestamp(%s),
                    last_seen_at = %s
                where id = %s
                """,
                (
                    payload.username,
                    payload.first_name,
                    payload.last_name,
                    payload.photo_url,
                    payload.auth_date,
                    now,
                    identity_id,
                ),
            )

    def create_session(self, user_id: UUID, refresh_token_hash: str, expires_at: datetime) -> dict:
        session_id = uuid4()
        now = datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.auth_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
                values (%s, %s, %s, %s, %s)
                returning id
                """,
                (session_id, user_id, refresh_token_hash, expires_at, now),
            )
            return cur.fetchone()
