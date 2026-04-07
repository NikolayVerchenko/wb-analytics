from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv('.env.courier')


def _get_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {'1', 'true', 'yes', 'on'}


def _is_local_url(value: str) -> bool:
    return '127.0.0.1' in value or 'localhost' in value


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv('APP_ENV', 'development')
    app_secret_key: str = os.getenv('APP_SECRET_KEY', 'dev-secret-change-me')
    frontend_base_url: str = os.getenv('FRONTEND_BASE_URL', 'http://127.0.0.1:5174')
    telegram_bot_token: str = os.getenv('TELEGRAM_BOT_TOKEN', '')
    access_token_ttl_minutes: int = int(os.getenv('ACCESS_TOKEN_TTL_MINUTES', '60'))
    refresh_token_ttl_days: int = int(os.getenv('REFRESH_TOKEN_TTL_DAYS', '30'))
    password_reset_ttl_minutes: int = int(os.getenv('PASSWORD_RESET_TTL_MINUTES', '30'))
    refresh_cookie_name: str = os.getenv('REFRESH_COOKIE_NAME', 'wb_refresh_token')
    refresh_cookie_domain: str | None = os.getenv('REFRESH_COOKIE_DOMAIN')
    refresh_cookie_samesite: str = os.getenv('REFRESH_COOKIE_SAMESITE', 'lax')
    refresh_cookie_secure: bool = _get_bool_env(
        'REFRESH_COOKIE_SECURE',
        default=os.getenv('APP_ENV', 'development') != 'development',
    )
    port: int = int(os.getenv('PORT', '8010'))

    pg_host: str | None = os.getenv('PGHOST')
    pg_port: str | None = os.getenv('PGPORT')
    pg_database: str | None = os.getenv('PGDATABASE')
    pg_user: str | None = os.getenv('PGUSER')
    pg_password: str | None = os.getenv('PGPASSWORD')

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == 'production'

    def validate_for_production(self) -> None:
        missing: list[str] = []
        unsafe: list[str] = []

        for name, value in {
            'APP_SECRET_KEY': self.app_secret_key,
            'FRONTEND_BASE_URL': self.frontend_base_url,
            'PGHOST': self.pg_host,
            'PGPORT': self.pg_port,
            'PGDATABASE': self.pg_database,
            'PGUSER': self.pg_user,
            'PGPASSWORD': self.pg_password,
        }.items():
            if value is None or str(value).strip() == '':
                missing.append(name)

        if self.app_secret_key == 'dev-secret-change-me':
            unsafe.append('APP_SECRET_KEY uses development default')

        if self.frontend_base_url and _is_local_url(self.frontend_base_url):
            unsafe.append('FRONTEND_BASE_URL points to localhost/127.0.0.1')

        if not self.refresh_cookie_secure:
            unsafe.append('REFRESH_COOKIE_SECURE must be true in production')

        if self.refresh_cookie_samesite.lower() not in {'lax', 'strict', 'none'}:
            unsafe.append('REFRESH_COOKIE_SAMESITE has invalid value')

        if missing or unsafe:
            parts: list[str] = []
            if missing:
                parts.append('missing: ' + ', '.join(missing))
            if unsafe:
                parts.append('unsafe: ' + '; '.join(unsafe))
            raise RuntimeError('Production settings validation failed: ' + ' | '.join(parts))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
