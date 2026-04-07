import time
from collections.abc import Iterable
from typing import Any

import requests


RETRYABLE_STATUSES = {500, 502, 503, 504}


class WbApiError(RuntimeError):
    pass


class WbApiNetworkError(WbApiError):
    pass


class WbApiHttpError(WbApiError):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(message)


class WbApiClient:
    def __init__(
        self,
        *,
        token: str,
        timeout: int = 60,
        max_retries: int = 3,
        backoff_seconds: float = 2.0,
        session: requests.Session | None = None,
    ) -> None:
        self._timeout = timeout
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._session = session or requests.Session()
        self._headers = {"Authorization": token}
        self._request_counter = 0

    def get(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        expected_statuses: Iterable[int] = (200,),
    ) -> requests.Response:
        return self.request(
            "GET",
            url,
            params=params,
            expected_statuses=set(expected_statuses),
        )

    def post(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        expected_statuses: Iterable[int] = (200,),
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        return self.request(
            "POST",
            url,
            params=params,
            json=json,
            expected_statuses=set(expected_statuses),
            headers=headers,
        )

    def request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        expected_statuses: set[int],
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        merged_headers = dict(self._headers)
        if headers:
            merged_headers.update(headers)

        last_error: Exception | None = None

        for attempt in range(1, self._max_retries + 2):
            self._request_counter += 1
            request_no = self._request_counter
            started_at = time.perf_counter()
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    headers=merged_headers,
                    params=params,
                    json=json,
                    timeout=self._timeout,
                )
            except requests.RequestException as exc:
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                print(
                    f"wb_api_request no={request_no} method={method} endpoint={url} attempt={attempt} "
                    f"status=network_error elapsed_ms={elapsed_ms}",
                )
                last_error = exc
                if attempt > self._max_retries:
                    raise WbApiNetworkError(f"Network error while calling {url}: {exc}") from exc
                self._sleep_before_retry(attempt)
                continue

            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            print(
                f"wb_api_request no={request_no} method={method} endpoint={url} attempt={attempt} "
                f"status={response.status_code} elapsed_ms={elapsed_ms}",
            )

            if response.status_code in expected_statuses:
                return response

            if response.status_code in RETRYABLE_STATUSES and attempt <= self._max_retries:
                self._sleep_before_retry(attempt)
                continue

            message = (response.text or "").strip() or f"HTTP {response.status_code}"
            raise WbApiHttpError(response.status_code, message)

        if last_error is not None:
            raise WbApiNetworkError(f"Network error while calling {url}: {last_error}") from last_error
        raise WbApiError(f"Request failed without response: {method} {url}")

    def _sleep_before_retry(self, attempt: int) -> None:
        time.sleep(self._backoff_seconds * attempt)
