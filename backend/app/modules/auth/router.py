from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
import psycopg

from backend.app.db import db_connection
from backend.app.settings import Settings, get_settings
from backend.app.security.rate_limit import rate_limit_dependency
from .cookies import clear_refresh_cookie, get_refresh_cookie, set_refresh_cookie
from .deps import get_current_user, get_token_service
from .repository import AuthRepository
from .schemas import (
    LogoutRequest,
    LogoutResponse,
    PasswordForgotRequest,
    PasswordForgotResponse,
    PasswordLoginRequest,
    PasswordRegisterRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    RefreshRequest,
    TokenPairResponse,
    UserRead,
)
from .service import AuthTokenService, PasswordHasher, PasswordResetService

router = APIRouter()

password_login_rate_limit = rate_limit_dependency('auth:password_login')
password_register_rate_limit = rate_limit_dependency('auth:password_register')
password_forgot_rate_limit = rate_limit_dependency('auth:password_forgot')
password_reset_rate_limit = rate_limit_dependency('auth:password_reset')


@router.post('/password/login', response_model=TokenPairResponse)
def login_with_password(
    payload: PasswordLoginRequest,
    request: Request,
    response: Response,
    _: None = Depends(password_login_rate_limit),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
    token_service: AuthTokenService = Depends(get_token_service),
) -> TokenPairResponse:
    repo = AuthRepository(conn)
    password_hasher = PasswordHasher()
    email = _normalize_email(payload.email)
    user = repo.get_user_credentials_by_email(email)
    if user is None or not password_hasher.verify_password(payload.password, user['password_hash']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password.')

    _ensure_user_can_login(user)
    return _issue_token_pair(repo, token_service, user, request=request, response=response, settings=settings)


@router.post('/password/register', response_model=TokenPairResponse)
def register_with_password(
    payload: PasswordRegisterRequest,
    request: Request,
    response: Response,
    _: None = Depends(password_register_rate_limit),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
    token_service: AuthTokenService = Depends(get_token_service),
) -> TokenPairResponse:
    repo = AuthRepository(conn)
    password_hasher = PasswordHasher()
    email = _normalize_email(payload.email)
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Name is too short.')

    existing_user = repo.get_user_credentials_by_email(email)
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='User with this email already exists.')

    password_hash = password_hasher.hash_password(payload.password)
    user_row = repo.create_user(name=name, email=email, password_hash=password_hash)
    user = repo.get_user_profile(user_row['user_id'])
    if user is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='User creation failed.')

    return _issue_token_pair(repo, token_service, user, request=request, response=response, settings=settings)


@router.post('/password/forgot', response_model=PasswordForgotResponse)
def forgot_password(
    payload: PasswordForgotRequest,
    _: None = Depends(password_forgot_rate_limit),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
) -> PasswordForgotResponse:
    repo = AuthRepository(conn)
    email = _normalize_email(payload.email)
    user = repo.get_user_credentials_by_email(email)
    reset_url = None

    if user is not None and user['status'] == 'active':
        reset_service = PasswordResetService(
            frontend_base_url=settings.frontend_base_url,
            ttl_minutes=settings.password_reset_ttl_minutes,
        )
        issued = reset_service.issue_reset_token()
        repo.revoke_active_password_reset_tokens_for_user(user['user_id'])
        repo.create_password_reset_token(user['user_id'], issued.token_hash, issued.expires_at)
        if settings.app_env == 'development':
            reset_url = reset_service.build_reset_url(issued.token)

    return PasswordForgotResponse(
        success=True,
        message='Если аккаунт с таким email существует, мы подготовили ссылку для сброса пароля.',
        reset_url=reset_url,
    )


@router.post('/password/reset', response_model=PasswordResetResponse)
def reset_password(
    payload: PasswordResetRequest,
    _: None = Depends(password_reset_rate_limit),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
) -> PasswordResetResponse:
    repo = AuthRepository(conn)
    token_hash = PasswordResetService.hash_token(payload.token)
    reset_token = repo.get_password_reset_token_by_hash(token_hash)
    if reset_token is None or reset_token['used_at'] is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Reset token is invalid or expired.')

    if reset_token['expires_at'] <= datetime.now(timezone.utc):
        repo.mark_password_reset_token_used(reset_token['id'])
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Reset token is invalid or expired.')

    user = repo.get_user_profile(reset_token['user_id'])
    if user is None or user['status'] != 'active':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='User is not active.')

    password_hasher = PasswordHasher()
    password_hash = password_hasher.hash_password(payload.password)
    repo.update_user_password(reset_token['user_id'], password_hash)
    repo.mark_password_reset_token_used(reset_token['id'])
    repo.revoke_active_password_reset_tokens_for_user(reset_token['user_id'])
    repo.revoke_all_sessions_for_user(reset_token['user_id'])

    return PasswordResetResponse(success=True, message='Пароль обновлён. Теперь вы можете войти с новым паролем.')


@router.get('/me', response_model=UserRead)
def get_me(current_user: dict = Depends(get_current_user)) -> UserRead:
    return _to_user_read(current_user)


@router.post('/refresh', response_model=TokenPairResponse)
def refresh_tokens(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
    token_service: AuthTokenService = Depends(get_token_service),
) -> TokenPairResponse:
    repo = AuthRepository(conn)
    refresh_token = _extract_refresh_token(request=request, settings=settings, payload=payload)
    refresh_token_hash = token_service.hash_refresh_token(refresh_token)
    session = repo.get_session_by_hash(refresh_token_hash)
    if session is None or session['revoked_at'] is not None:
        clear_refresh_cookie(response, request=request, settings=settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token is invalid.')

    if session['expires_at'] <= datetime.now(timezone.utc):
        repo.revoke_session_by_id(session['id'])
        clear_refresh_cookie(response, request=request, settings=settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token expired.')

    user = repo.get_user_profile(session['user_id'])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found.')

    repo.revoke_session_by_id(session['id'])
    return _issue_token_pair(repo, token_service, user, request=request, response=response, settings=settings)


@router.post('/logout', response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    payload: LogoutRequest | None = None,
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
    token_service: AuthTokenService = Depends(get_token_service),
) -> LogoutResponse:
    repo = AuthRepository(conn)
    refresh_token = _extract_refresh_token(request=request, settings=settings, payload=payload, required=False)
    if refresh_token is not None:
        refresh_token_hash = token_service.hash_refresh_token(refresh_token)
        repo.revoke_session_by_hash(refresh_token_hash)
    clear_refresh_cookie(response, request=request, settings=settings)
    return LogoutResponse(success=True)


def _to_user_read(user: dict) -> UserRead:
    return UserRead(
        id=str(user['user_id']),
        name=user.get('name'),
        email=user['email'],
        status=user['status'],
        telegram_linked=bool(user['telegram_linked']),
    )


def _issue_token_pair(
    repo: AuthRepository,
    token_service: AuthTokenService,
    user: dict,
    *,
    request: Request,
    response: Response,
    settings: Settings,
) -> TokenPairResponse:
    tokens = token_service.issue_token_pair(user['user_id'])
    repo.create_session(user['user_id'], tokens.refresh_token_hash, tokens.refresh_expires_at)
    set_refresh_cookie(
        response,
        request=request,
        settings=settings,
        refresh_token=tokens.refresh_token,
    )
    return TokenPairResponse(
        access_token=tokens.access_token,
        user=_to_user_read(user),
    )


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if '@' not in email or email.startswith('@') or email.endswith('@'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Enter a valid email.')
    return email


def _ensure_user_can_login(user: dict) -> None:
    if user['status'] != 'active':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='User is not active.')


def _extract_refresh_token(
    *,
    request: Request,
    settings: Settings,
    payload: RefreshRequest | LogoutRequest | None,
    required: bool = True,
) -> str | None:
    refresh_token = get_refresh_cookie(request, settings=settings)
    if refresh_token is None and payload is not None:
        refresh_token = payload.refresh_token
    if refresh_token is None and required:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token is missing.')
    return refresh_token
