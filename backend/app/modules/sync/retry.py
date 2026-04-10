from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


HTTP_CODE_PATTERN = re.compile(r"\b(429|500|502|503|504)\b")


@dataclass(frozen=True)
class RetryDecision:
    should_retry: bool
    next_retry_at: datetime | None = None


def get_retry_decision(error_message: str, *, attempt: int, max_attempts: int = 5) -> RetryDecision:
    if is_rate_limit_error(error_message):
        delay_seconds = _get_rate_limit_delay_seconds(attempt)
        return RetryDecision(
            should_retry=True,
            next_retry_at=datetime.now(timezone.utc) + timedelta(seconds=delay_seconds),
        )

    if attempt >= max_attempts:
        return RetryDecision(should_retry=False)

    if not is_retryable_error(error_message):
        return RetryDecision(should_retry=False)

    delay_seconds = min(300, 30 * (2 ** max(attempt - 1, 0)))
    return RetryDecision(
        should_retry=True,
        next_retry_at=datetime.now(timezone.utc) + timedelta(seconds=delay_seconds),
    )


def is_rate_limit_error(error_message: str) -> bool:
    lowered = error_message.lower()
    return 'too many requests' in lowered or 'limited by global limiter' in lowered or '429' in lowered


def is_retryable_error(error_message: str) -> bool:
    lowered = error_message.lower()
    if is_rate_limit_error(error_message):
        return True
    if 'timed out' in lowered or 'timeout' in lowered:
        return True
    if 'temporarily unavailable' in lowered:
        return True
    return HTTP_CODE_PATTERN.search(error_message) is not None


def _get_rate_limit_delay_seconds(attempt: int) -> int:
    return min(900, 180 * max(attempt, 1))


