from pydantic import BaseModel, Field


class UserRead(BaseModel):
    id: str
    name: str | None = None
    email: str
    status: str
    telegram_linked: bool


class RefreshRequest(BaseModel):
    refresh_token: str | None = None
    account_id: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class LogoutResponse(BaseModel):
    success: bool


class TokenPairResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserRead


class AccountScopeRequest(BaseModel):
    account_id: str


class PasswordLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class PasswordRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class PasswordForgotRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class PasswordForgotResponse(BaseModel):
    success: bool
    message: str
    reset_url: str | None = None


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    password: str = Field(min_length=8, max_length=128)


class PasswordResetResponse(BaseModel):
    success: bool
    message: str
