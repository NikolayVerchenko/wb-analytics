from time import perf_counter
from uuid import UUID

import psycopg


class StocksRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list_items(
        self,
        account_id: UUID,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict], dict]:
        search_value = f"%{search.strip()}%" if search and search.strip() else None
        with self._conn.cursor() as cur:
            sql = """
                with aggregated as (
                    select
                        account_id,
                        nm_id,
                        vendor_code,
                        tech_size,
                        max(brand_name) as brand_name,
                        max(subject_name) as subject_name,
                        max(photo_url) as photo_url,
                        max(snapshot_loaded_at) as snapshot_loaded_at,
                        sum(coalesce(total_on_warehouses, 0))::numeric as total_on_warehouses,
                        sum(coalesce(in_transit_to_customer, 0))::numeric as in_transit_to_customer,
                        sum(coalesce(in_transit_from_customer, 0))::numeric as in_transit_from_customer,
                        sum(coalesce(total_stock, 0))::numeric as total_stock,
                        case
                            when sum(coalesce(total_stock, 0)) = 0 then null
                            else round((sum(coalesce(stock_cogs_total, 0)) / sum(coalesce(total_stock, 0))), 2)
                        end::numeric as cogs_per_unit,
                        sum(coalesce(stock_cogs_total, 0))::numeric as stock_cogs_total
                    from mart.ui_stock_item_snapshot
                    where account_id = %s
                    group by account_id, nm_id, vendor_code, tech_size
                ),
                filtered as (
                    select *
                    from aggregated
                    where (%s::text is null or vendor_code ilike %s::text)
                ),
                totals as (
                    select
                        max(snapshot_loaded_at) as snapshot_loaded_at,
                        coalesce(sum(coalesce(total_on_warehouses, 0)), 0)::numeric as total_on_warehouses,
                        coalesce(sum(coalesce(in_transit_to_customer, 0)), 0)::numeric as in_transit_to_customer,
                        coalesce(sum(coalesce(in_transit_from_customer, 0)), 0)::numeric as in_transit_from_customer,
                        coalesce(sum(coalesce(total_stock, 0)), 0)::numeric as total_stock,
                        case
                            when sum(coalesce(total_stock, 0)) = 0 then null
                            else round((sum(coalesce(stock_cogs_total, 0)) / sum(coalesce(total_stock, 0))), 2)
                        end::numeric as cogs_per_unit,
                        coalesce(sum(coalesce(stock_cogs_total, 0)), 0)::numeric as stock_cogs_total
                    from filtered
                ),
                paged as (
                    select *
                    from filtered
                    order by total_stock desc, vendor_code asc, tech_size asc
                    limit %s
                    offset %s
                )
                select
                    (select row_to_json(t) from totals t) as totals,
                    coalesce((select json_agg(row_to_json(p)) from paged p), '[]'::json) as items
            """
            started_at = perf_counter()
            cur.execute(sql, (account_id, search_value, search_value, limit, offset))
            result = cur.fetchone() or {}
            elapsed_ms = (perf_counter() - started_at) * 1000
            rows = result.get('items') or []
            print(
                'stocks_items_timing '
                f'account_id={account_id} limit={limit} offset={offset} rows={len(rows)} '
                f'elapsed_ms={elapsed_ms:.1f}'
            )
            return rows, (result.get('totals') or {})

    def list_warehouses(
        self,
        account_id: UUID,
        nm_id: int,
        vendor_code: str,
        tech_size: str,
    ) -> list[dict]:
        normalized_vendor_code = vendor_code.strip().lower()
        normalized_tech_size = tech_size.strip().upper()
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    warehouse_name,
                    max(snapshot_loaded_at) as snapshot_loaded_at,
                    sum(coalesce(quantity, 0))::numeric as quantity
                from mart.ui_stock_warehouse_snapshot
                where account_id = %s
                  and nm_id = %s
                  and vendor_code = %s
                  and tech_size = %s
                group by warehouse_name
                order by quantity desc, warehouse_name asc
                """,
                (account_id, nm_id, normalized_vendor_code, normalized_tech_size),
            )
            return list(cur.fetchall())
