from dataclasses import dataclass

from courier.wb_api_client import WbApiClient, WbApiHttpError, WbApiNetworkError


SELLER_INFO_ENDPOINT = 'https://common-api.wildberries.ru/api/v1/seller-info'


class AccountConnectError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(message)


@dataclass(slots=True)
class SellerProfile:
    wb_seller_id: str
    seller_name: str | None
    trade_mark: str | None


class WbAccountClient:
    def fetch_seller_profile(self, token: str) -> SellerProfile:
        client = WbApiClient(token=token, timeout=30, max_retries=1, backoff_seconds=1.0)

        try:
            response = client.get(SELLER_INFO_ENDPOINT, expected_statuses={200})
        except WbApiHttpError as exc:
            if exc.status_code in {401, 403}:
                raise AccountConnectError(400, 'WB токен недействителен или не даёт доступ к кабинету.') from exc
            if exc.status_code == 429:
                raise AccountConnectError(503, 'WB API временно ограничил запросы. Попробуйте позже.') from exc
            raise AccountConnectError(502, 'Не удалось получить профиль кабинета из WB API.') from exc
        except WbApiNetworkError as exc:
            raise AccountConnectError(502, 'Не удалось связаться с WB API.') from exc

        payload = response.json()
        if not isinstance(payload, dict):
            raise AccountConnectError(502, 'WB API вернул некорректный профиль кабинета.')

        seller_id = payload.get('sid')
        if seller_id is None:
            raise AccountConnectError(502, 'WB API не вернул идентификатор кабинета.')

        seller_name = payload.get('name')
        trade_mark = payload.get('tradeMark')

        return SellerProfile(
            wb_seller_id=str(seller_id),
            seller_name=seller_name if isinstance(seller_name, str) and seller_name.strip() else None,
            trade_mark=trade_mark if isinstance(trade_mark, str) and trade_mark.strip() else None,
        )
