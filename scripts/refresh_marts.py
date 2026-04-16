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
        Path("db/marts/supplies/supply_items.sql"),
        Path("db/marts/calculation/sku_unit_economics_weekly.sql"),
        Path("db/marts/calculation/sku_unit_economics_day_closed.sql"),
        Path("db/marts/calculation/sku_unit_economics_day_item_closed.sql"),
        Path("db/marts/calculation/sku_unit_economics_day_current.sql"),
        Path("db/marts/calculation/sku_unit_economics_day_item_current.sql"),
        Path("db/marts/serving/drop_legacy_ui_views.sql"),
        Path("db/marts/serving/ui_item_size_day.sql"),
        Path("db/marts/serving/ui_item_day.sql"),
        Path("db/marts/serving/ui_item_day_filters.sql"),
        Path("db/marts/serving/ui_stock_item_snapshot.sql"),
        Path("db/marts/serving/ui_stock_warehouse_snapshot.sql"),
    ]

    with db_connection() as conn:
        with conn.cursor() as cur:
            for sql_file in sql_files:
                cur.execute(sql_file.read_text(encoding="utf-8"))
        conn.commit()


if __name__ == "__main__":
    main()

