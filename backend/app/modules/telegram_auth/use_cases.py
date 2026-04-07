from __future__ import annotations

from dataclasses import dataclass
import secrets

import psycopg

from backend.app.modules.auth.service import AuthTokenService, PasswordHasher
from .repository import TelegramAuthRepository
from .schemas import TelegramAuthPayload, TelegramLoginResult, TelegramUserRead
from .verifier import verify_telegram_auth


@dataclass(frozen=True)
class TelegramLoginConfig:
    bot_token: str
    app_secret_key: str
    access_token_ttl_minutes: int = 60
    refresh_ttl_days: int = 30


class LoginOrRegisterViaTelegramUseCase:
    def __init__(self, conn: psycopg.Connection, config: TelegramLoginConfig) -> None:
        self._repo = TelegramAuthRepository(conn)
        self._config = config
        self._password_hasher = PasswordHasher()
        self._token_service = AuthTokenService(
            secret_key=config.app_secret_key,
            access_ttl_minutes=config.access_token_ttl_minutes,
            refresh_ttl_days=config.refresh_ttl_days,
        )

    def execute(self, payload: TelegramAuthPayload) -> TelegramLoginResult:
        verify_telegram_auth(payload, bot_token=self._config.bot_token)

        identity = self._repo.get_identity_by_telegram_id(payload.id)
        is_new_user = False

        if identity:
            user_id = identity['user_id']
            user_name = identity['user_name']
            user_email = identity['email']
            user_status = identity['status']
            self._repo.update_identity_activity(identity['telegram_identity_id'], payload)
        else:
            is_new_user = True
            user_name = _build_user_name(payload)
            user_email = _build_user_email(payload)
            password_hash = self._password_hasher.hash_password(secrets.token_urlsafe(24))
            user_row = self._repo.create_user(user_name, user_email, password_hash)
            user_id = user_row['user_id']
            user_status = 'active'
            self._repo.create_identity(user_id, payload)

        tokens = self._token_service.issue_token_pair(user_id)
        self._repo.create_session(user_id, tokens.refresh_token_hash, tokens.refresh_expires_at)

        return TelegramLoginResult(
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            is_new_user=is_new_user,
            user=TelegramUserRead(
                id=str(user_id),
                name=user_name,
                email=user_email,
                status=user_status,
                telegram_linked=True,
            ),
        )

def _build_user_name(payload: TelegramAuthPayload) -> str:
    parts = [payload.first_name, payload.last_name]
    return ' '.join(part for part in parts if part)


def _build_user_email(payload: TelegramAuthPayload) -> str:
    return f"tg_{payload.id}@telegram.local"
