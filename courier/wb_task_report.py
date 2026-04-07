import time
from collections.abc import Callable, Iterable

import requests

from courier.wb_api_client import WbApiClient


def start_task(
    *,
    client: WbApiClient,
    source: str,
    create_url: str,
    create_params: dict,
    extract_task_id: Callable[[dict], str],
) -> str:
    response = client.get(
        create_url,
        params=create_params,
        expected_statuses={200},
    )
    task_id = extract_task_id(response.json())
    print(f"source={source} step=create http_status=200 task_id={task_id}")
    return task_id


def wait_task_done(
    *,
    client: WbApiClient,
    source: str,
    task_id: str,
    status_url_template: str,
    extract_status: Callable[[dict], str],
    poll_interval: int,
    max_attempts: int,
    task_label: str,
) -> str:
    for attempt in range(1, max_attempts + 1):
        response = client.get(
            status_url_template.format(task_id=task_id),
            expected_statuses={200},
        )
        status = extract_status(response.json())
        print(
            f"source={source} step=status http_status=200 attempt={attempt} "
            f"task_id={task_id} status={status}"
        )
        if status == "done":
            return status
        if status in {"error", "failed"}:
            raise RuntimeError(f"{task_label} task failed with status={status}")
        time.sleep(poll_interval)

    raise RuntimeError(f"{task_label} task polling timed out")


def download_task(
    *,
    client: WbApiClient,
    task_id: str,
    download_url_template: str,
    expected_statuses: Iterable[int],
) -> requests.Response:
    return client.get(
        download_url_template.format(task_id=task_id),
        expected_statuses=set(expected_statuses),
    )
