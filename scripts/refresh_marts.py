import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from courier.common import db_connection


def main() -> None:
    sql_files = [
        Path("db/marts/facts/fact_advert_day_item.sql"),
        Path("db/marts/facts/fact_deductions_day_unallocated.sql"),
        Path("db/marts/facts/fact_unit_economics_day_size_closed.sql"),
        Path("db/marts/facts/fact_unit_economics_day_size_current.sql"),
        Path("db/marts/facts/fact_unit_economics_weekly_size_closed.sql"),
        Path("db/marts/final/supply_items.sql"),
        Path("db/marts/final/sku_unit_economics.sql"),
        Path("db/marts/final/sku_unit_economics_weekly.sql"),
        Path("db/marts/final/sku_unit_economics_day_closed.sql"),
        Path("db/marts/final/sku_unit_economics_day_item_closed.sql"),
        Path("db/marts/final/sku_unit_economics_day_current.sql"),
        Path("db/marts/final/sku_unit_economics_day_item_current.sql"),
    ]

    with db_connection() as conn:
        with conn.cursor() as cur:
            for sql_file in sql_files:
                cur.execute(sql_file.read_text(encoding="utf-8"))
        conn.commit()


if __name__ == "__main__":
    main()
