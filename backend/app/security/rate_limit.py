from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, Request, status

from backend.app.settings import Settings, get_settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = monotonic()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail='Слишком много попыток. Повторите позже.',
                )
            bucket.append(now)


_limiter = InMemoryRateLimiter()


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get('x-forwarded-for', '')
    if forwarded_for:
        first = forwarded_for.split(',')[0].strip()
        if first:
            return first
    if request.client is not None and request.client.host:
        return request.client.host
    return 'unknown'


def rate_limit_dependency(bucket: str) -> Callable[..., None]:
    def dependency(
        request: Request,
        settings: Settings = Depends(get_settings),
    ) -> None:
        limit = settings.auth_rate_limit_max_requests
        window = settings.auth_rate_limit_window_seconds
        if limit <= 0 or window <= 0:
            return
        key = f'{bucket}:{_client_ip(request)}'
        _limiter.hit(key, limit=limit, window_seconds=window)

    return dependency
