from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import psycopg

from backend.app.db import db_connection
from backend.app.settings import Settings, get_settings
from .repository import AuthRepository
from .service import AuthTokenError, AuthTokenService

bearer_scheme = HTTPBearer(auto_error=False)


def get_token_service(settings: Settings = Depends(get_settings)) -> AuthTokenService:
    return AuthTokenService(
        secret_key=settings.app_secret_key,
        access_ttl_minutes=settings.access_token_ttl_minutes,
        refresh_ttl_days=settings.refresh_token_ttl_days,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    conn: psycopg.Connection = Depends(db_connection),
    token_service: AuthTokenService = Depends(get_token_service),
) -> dict:
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required.')

    try:
        token_payload = token_service.decode_access_token(credentials.credentials)
    except AuthTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    repo = AuthRepository(conn)
    user = repo.get_user_profile(token_payload.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found.')

    return user
