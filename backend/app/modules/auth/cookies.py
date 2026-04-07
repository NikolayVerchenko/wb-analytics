from __future__ import annotations

from fastapi import Request, Response

from backend.app.settings import Settings


def set_refresh_cookie(
    response: Response,
    *,
    request: Request,
    settings: Settings,
    refresh_token: str,
) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=_should_use_secure_cookie(request=request, settings=settings),
        samesite=settings.refresh_cookie_samesite,
        domain=settings.refresh_cookie_domain,
        max_age=settings.refresh_token_ttl_days * 24 * 60 * 60,
        path='/',
    )


def clear_refresh_cookie(
    response: Response,
    *,
    request: Request,
    settings: Settings,
) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        domain=settings.refresh_cookie_domain,
        path='/',
        secure=_should_use_secure_cookie(request=request, settings=settings),
        samesite=settings.refresh_cookie_samesite,
        httponly=True,
    )


def get_refresh_cookie(request: Request, *, settings: Settings) -> str | None:
    value = request.cookies.get(settings.refresh_cookie_name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _should_use_secure_cookie(*, request: Request, settings: Settings) -> bool:
    return (
        settings.refresh_cookie_secure
        or request.url.scheme == 'https'
        or settings.frontend_base_url.startswith('https://')
    )
