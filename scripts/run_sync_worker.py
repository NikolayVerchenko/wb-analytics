import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.modules.sync.worker import SyncWorker
from backend.app.settings import get_settings


def main() -> None:
    settings = get_settings()
    if settings.is_production:
        settings.validate_for_production()

    worker = SyncWorker(
        poll_seconds=settings.sync_worker_poll_seconds,
        max_steps_per_tick=settings.sync_worker_max_steps_per_tick,
        mode=settings.sync_worker_mode,
        dataset=settings.sync_worker_dataset,
    )
    worker.run_forever()


if __name__ == '__main__':
    main()
