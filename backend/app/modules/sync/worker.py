from __future__ import annotations

import time

from backend.app.db import get_db_connection
from backend.app.modules.sync.executor import SyncExecutor
from backend.app.modules.sync.repository import SyncRepository


class SyncWorker:
    def __init__(
        self,
        *,
        poll_seconds: int = 5,
        max_steps_per_tick: int = 1,
        mode: str | None = None,
        dataset: str | None = None,
    ) -> None:
        self._poll_seconds = poll_seconds
        self._max_steps_per_tick = max_steps_per_tick
        self._mode = mode
        self._dataset = dataset
        self._executor = SyncExecutor()

    def run_forever(self) -> None:
        while True:
            processed = self.run_once()
            if processed == 0:
                time.sleep(self._poll_seconds)

    def run_once(self) -> int:
        recovered = self._recover_timed_out_steps()
        if recovered > 0:
            print(f'recovered_timed_out_steps={recovered}')
        return self._executor.execute_pending_steps(
            mode=self._mode,
            dataset=self._dataset,
            max_steps=self._max_steps_per_tick,
        )

    def _recover_timed_out_steps(self) -> int:
        with get_db_connection() as conn:
            repository = SyncRepository(conn)
            recovered = repository.recover_timed_out_running_steps()
            conn.commit()
        return recovered
