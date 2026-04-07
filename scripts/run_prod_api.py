import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn

from backend.app.settings import get_settings


def main() -> None:
    settings = get_settings()
    if settings.is_production:
        settings.validate_for_production()

    uvicorn.run(
        'backend.app.main:app',
        host='0.0.0.0',
        port=settings.port,
        proxy_headers=True,
        forwarded_allow_ips='*',
    )


if __name__ == '__main__':
    main()
