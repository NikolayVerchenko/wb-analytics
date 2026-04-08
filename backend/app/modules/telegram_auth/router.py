from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
import psycopg

from backend.app.db import db_connection
from backend.app.modules.auth.cookies import set_refresh_cookie
from backend.app.security.rate_limit import rate_limit_dependency
from backend.app.settings import Settings, get_settings
from .schemas import TelegramAuthPayload, TelegramLoginResponse, TelegramLoginResult
from .use_cases import LoginOrRegisterViaTelegramUseCase, TelegramLoginConfig

router = APIRouter()

telegram_login_rate_limit = rate_limit_dependency('auth:telegram_login')
telegram_callback_rate_limit = rate_limit_dependency('auth:telegram_callback')


def get_login_use_case(conn: psycopg.Connection, settings: Settings) -> LoginOrRegisterViaTelegramUseCase:
    config = TelegramLoginConfig(
        bot_token=settings.telegram_bot_token,
        app_secret_key=settings.app_secret_key,
        access_token_ttl_minutes=settings.access_token_ttl_minutes,
        refresh_ttl_days=settings.refresh_token_ttl_days,
    )
    return LoginOrRegisterViaTelegramUseCase(conn, config)


@router.post('/telegram/login', response_model=TelegramLoginResponse)
def telegram_login(
    payload: TelegramAuthPayload,
    request: Request,
    response: Response,
    _: None = Depends(telegram_login_rate_limit),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
) -> TelegramLoginResponse:
    use_case = get_login_use_case(conn, settings)
    try:
        result = use_case.execute(payload)
        set_refresh_cookie(
            response,
            request=request,
            settings=settings,
            refresh_token=result.refresh_token,
        )
        return TelegramLoginResponse(
            access_token=result.access_token,
            is_new_user=result.is_new_user,
            user=result.user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/telegram/callback')
def telegram_login_redirect(
    request: Request,
    _: None = Depends(telegram_callback_rate_limit),
    payload: TelegramAuthPayload = Depends(),
    conn: psycopg.Connection = Depends(db_connection),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    use_case = get_login_use_case(conn, settings)
    try:
        result = use_case.execute(payload)
        is_new_user = '1' if result.is_new_user else '0'
        response = RedirectResponse(
            url=f'{settings.frontend_base_url}/register?auth=success&is_new_user={is_new_user}',
            status_code=303,
        )
        if request is not None:
            set_refresh_cookie(
                response,
                request=request,
                settings=settings,
                refresh_token=result.refresh_token,
            )
        return response
    except ValueError as exc:
        return RedirectResponse(
            url=f'{settings.frontend_base_url}/register?auth=error&message={str(exc)}',
            status_code=303,
        )
