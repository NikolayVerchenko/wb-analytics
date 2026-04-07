import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from courier.common import db_connection


def main() -> None:
    sql_files = [
        Path('db/marts/serving/ui_stock_item_snapshot.sql'),
        Path('db/marts/serving/ui_stock_warehouse_snapshot.sql'),
    ]

    with db_connection() as conn:
        with conn.cursor() as cur:
            for sql_file in sql_files:
                cur.execute(sql_file.read_text(encoding='utf-8'))
        conn.commit()


if __name__ == '__main__':
    main()
