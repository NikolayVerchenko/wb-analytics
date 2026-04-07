import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn
from backend.app.main import app


def main() -> None:
    schema = app.openapi()["components"]["schemas"]["StockSnapshotItemRead"]
    print(json.dumps(schema, ensure_ascii=False), flush=True)
    uvicorn.run(app, host="127.0.0.1", port=8010)


if __name__ == "__main__":
    main()
