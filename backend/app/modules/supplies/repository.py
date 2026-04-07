from decimal import Decimal
from uuid import UUID

import psycopg


class SuppliesRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list_supplies(self, account_id: UUID) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    account_id,
                    supply_id,
                    max(preorder_id) as preorder_id,
                    max(status_id) as status_id,
                    max(create_date) as create_date,
                    max(supply_date) as supply_date,
                    max(fact_date) as fact_date,
                    max(updated_date) as updated_date,
                    count(*)::int as items_count,
                    coalesce(sum(quantity), 0)::int as planned_quantity,
                    coalesce(sum(accepted_quantity), 0)::int as accepted_quantity_total
                from mart.supply_items
                where account_id = %s
                group by account_id, supply_id
                order by coalesce(max(supply_date), max(create_date), max(updated_date)) desc nulls last, supply_id desc
                """,
                (account_id,),
            )
            return list(cur.fetchall())

    def list_supply_items(self, account_id: UUID, supply_id: int) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    si.account_id,
                    si.supply_id,
                    si.preorder_id,
                    si.supply_target_id,
                    si.is_preorder_id,
                    si.status_id,
                    si.create_date,
                    si.supply_date,
                    si.fact_date,
                    si.updated_date,
                    si.nm_id,
                    si.vendor_code,
                    si.tech_size,
                    si.barcode,
                    si.color,
                    si.need_kiz,
                    si.tnved,
                    si.supplier_box_amount,
                    si.quantity,
                    si.ready_for_sale_quantity,
                    si.unloading_quantity,
                    si.accepted_quantity,
                    si.photo_url,
                    sic.unit_cogs
                from mart.supply_items si
                left join core.account_supply_item_costs sic
                  on sic.account_id = si.account_id
                 and sic.supply_id = si.supply_id
                 and sic.nm_id = si.nm_id
                 and sic.vendor_code = si.vendor_code
                 and coalesce(sic.tech_size, '') = coalesce(si.tech_size, '')
                 and coalesce(sic.barcode, '') = coalesce(si.barcode, '')
                where si.account_id = %s
                  and si.supply_id = %s
                order by si.vendor_code nulls last, si.tech_size nulls first, si.barcode nulls last
                """,
                (account_id, supply_id),
            )
            return list(cur.fetchall())

    def upsert_supply_item_cost(
        self,
        account_id: UUID,
        supply_id: int,
        nm_id: int,
        vendor_code: str,
        tech_size: str | None,
        barcode: str | None,
        unit_cogs: Decimal,
    ) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.account_supply_item_costs (
                    account_id,
                    supply_id,
                    nm_id,
                    vendor_code,
                    tech_size,
                    barcode,
                    unit_cogs
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (account_id, supply_id, nm_id, vendor_code, tech_size, barcode)
                do update set
                    unit_cogs = excluded.unit_cogs,
                    updated_at = now()
                returning
                    account_id,
                    supply_id,
                    nm_id,
                    vendor_code,
                    tech_size,
                    barcode,
                    unit_cogs,
                    updated_at
                """,
                (account_id, supply_id, nm_id, vendor_code, tech_size, barcode, unit_cogs),
            )
            return cur.fetchone()

    def upsert_supply_article_cost_for_all_sizes(
        self,
        account_id: UUID,
        supply_id: int,
        nm_id: int,
        vendor_code: str,
        unit_cogs: Decimal,
    ) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                with matching_items as (
                    select distinct
                        si.account_id,
                        si.supply_id,
                        si.nm_id,
                        si.vendor_code,
                        si.tech_size,
                        si.barcode
                    from mart.supply_items si
                    where si.account_id = %s
                      and si.supply_id = %s
                      and si.nm_id = %s
                      and si.vendor_code = %s
                ),
                upserted as (
                    insert into core.account_supply_item_costs (
                        account_id,
                        supply_id,
                        nm_id,
                        vendor_code,
                        tech_size,
                        barcode,
                        unit_cogs
                    )
                    select
                        mi.account_id,
                        mi.supply_id,
                        mi.nm_id,
                        mi.vendor_code,
                        mi.tech_size,
                        mi.barcode,
                        %s
                    from matching_items mi
                    on conflict (account_id, supply_id, nm_id, vendor_code, tech_size, barcode)
                    do update set
                        unit_cogs = excluded.unit_cogs,
                        updated_at = now()
                    returning 1
                )
                select count(*)::int as affected_rows
                from upserted
                """,
                (account_id, supply_id, nm_id, vendor_code, unit_cogs),
            )
            row = cur.fetchone()
            return row["affected_rows"] if row else 0
