from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv('.env.courier')


def _get_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {'1', 'true', 'yes', 'on'}


def _is_local_url(value: str) -> bool:
    return '127.0.0.1' in value or 'localhost' in value


def _split_csv(raw: str | None) -> list[str]:
    if raw is None:
        return []
    return [item.strip() for item in raw.split(',') if item.strip()]


def _get_optional_env(name: str) -> str | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip()
    return value or None


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
    auth_rate_limit_max_requests: int = int(os.getenv('AUTH_RATE_LIMIT_MAX_REQUESTS', '10'))
    auth_rate_limit_window_seconds: int = int(os.getenv('AUTH_RATE_LIMIT_WINDOW_SECONDS', '60'))
    web_concurrency: int = int(os.getenv('WEB_CONCURRENCY', '2'))
    pgpool_min_size: int = int(os.getenv('PGPOOL_MIN_SIZE', '2'))
    pgpool_max_size: int = int(os.getenv('PGPOOL_MAX_SIZE', '10'))
    pgpool_timeout_seconds: int = int(os.getenv('PGPOOL_TIMEOUT_SECONDS', '10'))
    sync_worker_poll_seconds: int = int(os.getenv('SYNC_WORKER_POLL_SECONDS', '5'))
    sync_worker_max_steps_per_tick: int = int(os.getenv('SYNC_WORKER_MAX_STEPS_PER_TICK', '1'))
    sync_worker_mode: str | None = _get_optional_env('SYNC_WORKER_MODE')
    sync_worker_dataset: str | None = _get_optional_env('SYNC_WORKER_DATASET')
    app_allowed_hosts_raw: str = os.getenv('APP_ALLOWED_HOSTS', '')
    port: int = int(os.getenv('PORT', '8010'))

    pg_host: str | None = os.getenv('PGHOST')
    pg_port: str | None = os.getenv('PGPORT')
    pg_database: str | None = os.getenv('PGDATABASE')
    pg_user: str | None = os.getenv('PGUSER')
    pg_password: str | None = os.getenv('PGPASSWORD')

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == 'production'

    @property
    def allowed_hosts(self) -> list[str]:
        configured = _split_csv(self.app_allowed_hosts_raw)
        if configured:
            return configured

        default_hosts = ['localhost', '127.0.0.1', 'testserver']
        parsed = urlparse(self.frontend_base_url)
        host = parsed.hostname
        if host and host not in default_hosts:
            default_hosts.append(host)
        cookie_host = (self.refresh_cookie_domain or '').strip()
        if cookie_host and cookie_host not in default_hosts:
            default_hosts.append(cookie_host)
        return default_hosts

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
            'APP_ALLOWED_HOSTS': ','.join(self.allowed_hosts),
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

        if self.auth_rate_limit_max_requests <= 0:
            unsafe.append('AUTH_RATE_LIMIT_MAX_REQUESTS must be > 0 in production')

        if self.auth_rate_limit_window_seconds <= 0:
            unsafe.append('AUTH_RATE_LIMIT_WINDOW_SECONDS must be > 0 in production')

        if self.web_concurrency <= 0:
            unsafe.append('WEB_CONCURRENCY must be > 0 in production')

        if self.pgpool_min_size <= 0:
            unsafe.append('PGPOOL_MIN_SIZE must be > 0 in production')

        if self.pgpool_max_size < self.pgpool_min_size:
            unsafe.append('PGPOOL_MAX_SIZE must be >= PGPOOL_MIN_SIZE in production')

        if self.pgpool_timeout_seconds <= 0:
            unsafe.append('PGPOOL_TIMEOUT_SECONDS must be > 0 in production')

        if self.sync_worker_poll_seconds <= 0:
            unsafe.append('SYNC_WORKER_POLL_SECONDS must be > 0 in production')

        if self.sync_worker_max_steps_per_tick <= 0:
            unsafe.append('SYNC_WORKER_MAX_STEPS_PER_TICK must be > 0 in production')

        if any(host in {'localhost', '127.0.0.1'} for host in self.allowed_hosts):
            unsafe.append('APP_ALLOWED_HOSTS still contains localhost/127.0.0.1')

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
