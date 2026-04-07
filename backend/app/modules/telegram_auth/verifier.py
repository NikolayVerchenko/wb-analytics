from __future__ import annotations

import hashlib
import hmac
import time

from .schemas import TelegramAuthPayload


class TelegramAuthError(ValueError):
    pass


def verify_telegram_auth(
    payload: TelegramAuthPayload,
    *,
    bot_token: str,
    max_age_seconds: int = 300,
    clock_skew_seconds: int = 30,
) -> None:
    """
    Raises TelegramAuthError if payload is invalid.

    Steps (simplified):
    1) Build data_check_string from payload fields.
    2) Compute HMAC-SHA256 with secret derived from bot_token.
    3) Compare with payload.hash.
    4) Check auth_date freshness.
    """
    if not bot_token:
        raise TelegramAuthError('Telegram bot token is not configured')

    data_check_string = _build_data_check_string(payload)
    expected_hash = _compute_hash(data_check_string, bot_token)

    if not hmac.compare_digest(expected_hash, payload.hash):
        raise TelegramAuthError('Invalid telegram payload signature')

    _validate_auth_date(payload.auth_date, max_age_seconds, clock_skew_seconds)


def _build_data_check_string(payload: TelegramAuthPayload) -> str:
    items = payload.data_check_dict()
    return '\n'.join(f'{key}={items[key]}' for key in sorted(items.keys()))


def _compute_hash(data_check_string: str, bot_token: str) -> str:
    secret_key = hashlib.sha256(bot_token.encode('utf-8')).digest()
    return hmac.new(secret_key, data_check_string.encode('utf-8'), hashlib.sha256).hexdigest()


def _validate_auth_date(auth_date: int, max_age_seconds: int, clock_skew_seconds: int) -> None:
    now = int(time.time())
    if auth_date > now + clock_skew_seconds:
        raise TelegramAuthError('Telegram auth_date is in the future')
    if now - auth_date > max_age_seconds:
        raise TelegramAuthError('Telegram auth payload is too old')
