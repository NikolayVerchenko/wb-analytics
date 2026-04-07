from pydantic import BaseModel


class TelegramAuthPayload(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str

    def data_check_dict(self) -> dict[str, str]:
        data: dict[str, str] = {
            'id': str(self.id),
            'first_name': self.first_name,
            'auth_date': str(self.auth_date),
        }
        if self.last_name:
            data['last_name'] = self.last_name
        if self.username:
            data['username'] = self.username
        if self.photo_url:
            data['photo_url'] = self.photo_url
        return data


class TelegramUserRead(BaseModel):
    id: str
    name: str | None = None
    email: str
    status: str
    telegram_linked: bool


class TelegramLoginResult(BaseModel):
    access_token: str
    refresh_token: str
    is_new_user: bool
    user: TelegramUserRead


class TelegramLoginResponse(BaseModel):
    access_token: str
    is_new_user: bool
    user: TelegramUserRead
