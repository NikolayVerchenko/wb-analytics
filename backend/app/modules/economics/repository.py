from datetime import date
from decimal import Decimal
from time import perf_counter
from uuid import UUID

import psycopg

class EconomicsRepository:
    def __init__(self, conn: psycopg.AsyncConnection) -> None:
        self._conn = conn

    async def user_has_account_access(self, user_id: UUID, account_id: UUID) -> bool:
        async with self._conn.cursor() as cur:
            await cur.execute(
                """
                select exists(
                    select 1
                    from core.user_accounts
                    where user_id = %s
                      and account_id = %s
                ) as has_access
                """,
                (user_id, account_id),
            )
            row = await cur.fetchone()
            return bool(row['has_access']) if row is not None else False

    def _build_period_items_base_query(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        search: str | None,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        only_negative_profit: bool,
        min_profit: Decimal | None,
        max_profit: Decimal | None,
    ) -> tuple[str, tuple]:
        search_value = f'%{search.strip()}%' if search and search.strip() else None
        base_sql = """
            with aggregated as (
                select
                    'serving'::text as source_mode,
                    account_id,
                    %s::date as date_from,
                    %s::date as date_to,
                    min(week_start) as week_start,
                    nm_id,
                    vendor_code,
                    max(brand_name) as brand_name,
                    max(subject_name) as subject_name,
                    string_agg(distinct nullif(btrim(bonus_type_name), ''), '; ') as bonus_type_name,
                    max(account_name) as account_name,
                    max(photo_url) as photo_url,
                    sum(coalesce(order_count, 0))::bigint as order_count,
                    sum(coalesce(sales_quantity, 0))::bigint as sales_quantity,
                    sum(coalesce(return_quantity, 0))::bigint as return_quantity,
                    sum(coalesce(retail_price_sale, 0))::numeric as retail_price_sale,
                    sum(coalesce(retail_price_return, 0))::numeric as retail_price_return,
                    sum(coalesce(realization_before_spp, 0))::numeric as realization_before_spp,
                    sum(coalesce(retail_amount_sale, 0))::numeric as retail_amount_sale,
                    sum(coalesce(retail_amount_return, 0))::numeric as retail_amount_return,
                    sum(coalesce(realization_after_spp, 0))::numeric as realization_after_spp,
                    sum(coalesce(spp_amount, 0))::numeric as spp_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(spp_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as spp_percent,
                    sum(coalesce(ppvz_for_pay_sale, 0))::numeric as ppvz_for_pay_sale,
                    sum(coalesce(ppvz_for_pay_return, 0))::numeric as ppvz_for_pay_return,
                    sum(coalesce(seller_transfer, 0))::numeric as seller_transfer,
                    sum(coalesce(delivery_quantity, 0))::numeric as delivery_quantity,
                    sum(coalesce(refusal_quantity, 0))::numeric as refusal_quantity,
                    case
                        when sum(coalesce(delivery_quantity, 0)) = 0 then null
                        else round((sum(coalesce(sales_quantity, 0)) / sum(coalesce(delivery_quantity, 0))) * 100, 2)
                    end::numeric as buyout_percent,
                    sum(coalesce(delivery_cost_base, 0))::numeric as delivery_cost_base,
                    sum(coalesce(delivery_cost_correction, 0))::numeric as delivery_cost_correction,
                    sum(coalesce(delivery_cost, 0))::numeric as delivery_cost,
                    sum(coalesce(penalty_cost, 0))::numeric as penalty_cost,
                    sum(coalesce(cashback_amount, 0))::numeric as cashback_amount,
                    sum(coalesce(paid_storage_cost, 0))::numeric as paid_storage_cost,
                    sum(coalesce(advert_cost, 0))::numeric as advert_cost,
                    sum(coalesce(acceptance_cost, 0))::numeric as acceptance_cost,
                    sum(coalesce(wb_commission_amount, 0))::numeric as wb_commission_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(wb_commission_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as wb_commission_percent,
                    sum(coalesce(tax_amount, 0))::numeric as tax_amount,
                    sum(coalesce(cogs_amount, 0))::numeric as cogs_amount,
                    sum(coalesce(profit_amount, 0))::numeric as profit_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(profit_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as margin_percent,
                    case
                        when sum(coalesce(cogs_amount, 0)) = 0 then null
                        else round((sum(coalesce(profit_amount, 0)) / sum(coalesce(cogs_amount, 0))) * 100, 2)
                    end::numeric as roi_percent
                from mart.ui_item_day
                where account_id = %s
                  and calendar_date between %s and %s
                group by account_id, nm_id, vendor_code
            ),
            filtered as (
                select *
                from aggregated
                where (%s::text is null or vendor_code ilike %s::text)
                  and (%s::text[] is null or subject_name = any(%s::text[]))
                  and (%s::text[] is null or brand_name = any(%s::text[]))
                  and (%s::text[] is null or vendor_code = any(%s::text[]))
                  and (%s = false or profit_amount < 0)
                  and (%s::numeric is null or profit_amount >= %s::numeric)
                  and (%s::numeric is null or profit_amount <= %s::numeric)
            )
        """
        base_params = (
            date_from,
            date_to,
            account_id,
            date_from,
            date_to,
            search_value,
            search_value,
            subjects,
            subjects,
            brands,
            brands,
            articles,
            articles,
            only_negative_profit,
            min_profit,
            min_profit,
            max_profit,
            max_profit,
        )
        return base_sql, base_params

    def _build_dashboard_totals_query(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        search: str | None,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        only_negative_profit: bool,
        min_profit: Decimal | None,
        max_profit: Decimal | None,
    ) -> tuple[str, tuple]:
        search_value = f'%{search.strip()}%' if search and search.strip() else None
        sql = """
            with filtered as (
                select *
                from mart.ui_item_day
                where account_id = %s
                  and calendar_date between %s and %s
                  and (%s::text is null or vendor_code ilike %s::text)
                  and (%s::text[] is null or subject_name = any(%s::text[]))
                  and (%s::text[] is null or brand_name = any(%s::text[]))
                  and (%s::text[] is null or vendor_code = any(%s::text[]))
                  and (%s = false or profit_amount < 0)
                  and (%s::numeric is null or profit_amount >= %s::numeric)
                  and (%s::numeric is null or profit_amount <= %s::numeric)
            ),
            totals as (
                select
                    coalesce(sum(coalesce(order_count, 0)), 0)::numeric as order_count,
                    coalesce(sum(coalesce(sales_quantity, 0)), 0)::numeric as sales_quantity,
                    coalesce(sum(coalesce(delivery_quantity, 0)), 0)::numeric as delivery_quantity,
                    coalesce(sum(coalesce(refusal_quantity, 0)), 0)::numeric as refusal_quantity,
                    coalesce(sum(coalesce(return_quantity, 0)), 0)::numeric as return_quantity,
                    coalesce(sum(coalesce(realization_before_spp, 0)), 0)::numeric as realization_before_spp,
                    coalesce(sum(coalesce(realization_after_spp, 0)), 0)::numeric as realization_after_spp,
                    coalesce(sum(coalesce(spp_amount, 0)), 0)::numeric as spp_amount,
                    coalesce(sum(coalesce(seller_transfer, 0)), 0)::numeric as seller_transfer,
                    coalesce(sum(coalesce(wb_commission_amount, 0)), 0)::numeric as wb_commission_amount,
                    coalesce(sum(coalesce(advert_cost, 0)), 0)::numeric as advert_cost,
                    coalesce(sum(coalesce(delivery_cost_base, 0)), 0)::numeric as delivery_cost_base,
                    coalesce(sum(coalesce(delivery_cost_correction, 0)), 0)::numeric as delivery_cost_correction,
                    coalesce(sum(coalesce(delivery_cost, 0)), 0)::numeric as delivery_cost,
                    coalesce(sum(coalesce(paid_storage_cost, 0)), 0)::numeric as paid_storage_cost,
                    coalesce(sum(coalesce(penalty_cost, 0)), 0)::numeric as penalty_cost,
                    coalesce(sum(coalesce(acceptance_cost, 0)), 0)::numeric as acceptance_cost,
                    coalesce(sum(coalesce(tax_amount, 0)), 0)::numeric as tax_amount,
                    coalesce(sum(coalesce(cogs_amount, 0)), 0)::numeric as cogs_amount,
                    coalesce(sum(coalesce(profit_amount, 0)), 0)::numeric as profit_amount
                from filtered
            )
            select
                order_count,
                sales_quantity,
                delivery_quantity,
                refusal_quantity,
                return_quantity,
                case
                    when delivery_quantity = 0 then null
                    else round((sales_quantity / delivery_quantity) * 100, 2)
                end::numeric as buyout_percent,
                realization_before_spp,
                realization_after_spp,
                spp_amount,
                case
                    when realization_before_spp = 0 then null
                    else round((spp_amount / realization_before_spp) * 100, 2)
                end::numeric as spp_percent,
                seller_transfer,
                wb_commission_amount,
                case
                    when realization_before_spp = 0 then null
                    else round((wb_commission_amount / realization_before_spp) * 100, 2)
                end::numeric as wb_commission_percent,
                advert_cost,
                delivery_cost_base,
                delivery_cost_correction,
                delivery_cost,
                paid_storage_cost,
                penalty_cost,
                acceptance_cost,
                tax_amount,
                cogs_amount,
                profit_amount,
                case
                    when realization_before_spp = 0 then null
                    else round((profit_amount / realization_before_spp) * 100, 2)
                end::numeric as margin_percent,
                case
                    when cogs_amount = 0 then null
                    else round((profit_amount / cogs_amount) * 100, 2)
                end::numeric as roi_percent
            from totals
        """
        params = (
            account_id,
            date_from,
            date_to,
            search_value,
            search_value,
            subjects,
            subjects,
            brands,
            brands,
            articles,
            articles,
            only_negative_profit,
            min_profit,
            min_profit,
            max_profit,
            max_profit,
        )
        return sql, params
    async def list_period_items(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        search: str | None,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        order_by: str,
        limit: int,
        offset: int,
        only_negative_profit: bool,
        min_profit: Decimal | None,
        max_profit: Decimal | None,
    ) -> tuple[list[dict], dict]:
        async with self._conn.cursor() as cur:
            base_sql, base_params = self._build_period_items_base_query(
                account_id=account_id, date_from=date_from, date_to=date_to, search=search,
                subjects=subjects, brands=brands, articles=articles,
                only_negative_profit=only_negative_profit, min_profit=min_profit, max_profit=max_profit,
            )
            items_sql = (
                base_sql
                + f"""
                , paged as (
                    select * from filtered order by {order_by} limit %s offset %s
                )
                select coalesce((select json_agg(row_to_json(p)) from paged p), '[]'::json) as items
                """
            )
            started_at = perf_counter()
            await cur.execute(items_sql, base_params + (limit, offset))
            result = await cur.fetchone() or {}
            elapsed_ms = (perf_counter() - started_at) * 1000
            rows = result.get('items') or []
            print(f'economics_period_items_timing account_id={account_id} items_ms={elapsed_ms:.1f}')

        totals_row = await self.get_period_totals(
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            search=search,
            subjects=subjects,
            brands=brands,
            articles=articles,
            only_negative_profit=only_negative_profit,
            min_profit=min_profit,
            max_profit=max_profit,
        )

        return rows, totals_row

    async def get_period_totals(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        search: str | None,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        only_negative_profit: bool,
        min_profit: Decimal | None,
        max_profit: Decimal | None,
    ) -> dict:
        async with self._conn.cursor() as cur:
            sql, params = self._build_dashboard_totals_query(
                account_id=account_id,
                date_from=date_from,
                date_to=date_to,
                search=search,
                subjects=subjects,
                brands=brands,
                articles=articles,
                only_negative_profit=only_negative_profit,
                min_profit=min_profit,
                max_profit=max_profit,
            )
            started_at = perf_counter()
            await cur.execute(sql, params)
            row = await cur.fetchone() or {}
            elapsed_ms = (perf_counter() - started_at) * 1000
            print(
                'economics_period_totals_timing '
                f'account_id={account_id} date_from={date_from} date_to={date_to} '
                f'elapsed_ms={elapsed_ms:.1f}'
            )
            return row

    async def list_period_sizes(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        nm_id: int,
        vendor_code: str,
    ) -> list[dict]:
        async with self._conn.cursor() as cur:
            await cur.execute(
                """
                select
                    case when count(distinct source_mode) = 1 then max(source_mode) else 'mixed' end as source_mode,
                    account_id,
                    %s::date as date_from,
                    %s::date as date_to,
                    min(week_start) as week_start,
                    nm_id,
                    vendor_code,
                    ts_name,
                    max(brand_name) as brand_name,
                    max(subject_name) as subject_name,
                    string_agg(distinct nullif(btrim(bonus_type_name), ''), '; ') as bonus_type_name,
                    max(account_name) as account_name,
                    max(photo_url) as photo_url,
                    sum(coalesce(sales_quantity, 0))::bigint as sales_quantity,
                    sum(coalesce(return_quantity, 0))::bigint as return_quantity,
                    sum(coalesce(retail_price_sale, 0))::numeric as retail_price_sale,
                    sum(coalesce(retail_price_return, 0))::numeric as retail_price_return,
                    sum(coalesce(realization_before_spp, 0))::numeric as realization_before_spp,
                    sum(coalesce(retail_amount_sale, 0))::numeric as retail_amount_sale,
                    sum(coalesce(retail_amount_return, 0))::numeric as retail_amount_return,
                    sum(coalesce(realization_after_spp, 0))::numeric as realization_after_spp,
                    sum(coalesce(spp_amount, 0))::numeric as spp_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(spp_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as spp_percent,
                    sum(coalesce(ppvz_for_pay_sale, 0))::numeric as ppvz_for_pay_sale,
                    sum(coalesce(ppvz_for_pay_return, 0))::numeric as ppvz_for_pay_return,
                    sum(coalesce(seller_transfer, 0))::numeric as seller_transfer,
                    sum(coalesce(delivery_quantity, 0))::numeric as delivery_quantity,
                    sum(coalesce(refusal_quantity, 0))::numeric as refusal_quantity,
                    case
                        when sum(coalesce(delivery_quantity, 0)) = 0 then null
                        else round((sum(coalesce(sales_quantity, 0)) / sum(coalesce(delivery_quantity, 0))) * 100, 2)
                    end::numeric as buyout_percent,
                    sum(coalesce(delivery_cost_base, 0))::numeric as delivery_cost_base,
                    sum(coalesce(delivery_cost_correction, 0))::numeric as delivery_cost_correction,
                    sum(coalesce(delivery_cost, 0))::numeric as delivery_cost,
                    sum(coalesce(penalty_cost, 0))::numeric as penalty_cost,
                    sum(coalesce(cashback_amount, 0))::numeric as cashback_amount,
                    sum(coalesce(paid_storage_cost, 0))::numeric as paid_storage_cost,
                    sum(coalesce(tax_amount, 0))::numeric as tax_amount,
                    sum(coalesce(cogs_amount, 0))::numeric as cogs_amount,
                    sum(coalesce(profit_amount, 0))::numeric as profit_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(profit_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as margin_percent,
                    case
                        when sum(coalesce(cogs_amount, 0)) = 0 then null
                        else round((sum(coalesce(profit_amount, 0)) / sum(coalesce(cogs_amount, 0))) * 100, 2)
                    end::numeric as roi_percent,
                    sum(coalesce(wb_commission_amount, 0))::numeric as wb_commission_amount,
                    case
                        when sum(coalesce(realization_before_spp, 0)) = 0 then null
                        else round((sum(coalesce(wb_commission_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
                    end::numeric as wb_commission_percent
                from mart.ui_item_size_day
                where account_id = %s
                  and calendar_date between %s and %s
                  and nm_id = %s
                  and vendor_code = %s
                group by account_id, nm_id, vendor_code, ts_name
                order by ts_name nulls first
                """,
                (
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                    nm_id,
                    vendor_code,
                ),
            )
            return list(await cur.fetchall())


    async def list_filter_options(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> dict:
        async with self._conn.cursor() as cur:
            started_at = perf_counter()
            await cur.execute(
                """
                with
                subjects as (
                    select distinct value, label, hint from mart.ui_item_day_filters
                    where account_id = %s and filter_type = 'subject' and calendar_date between %s and %s
                ),
                brands as (
                    select distinct value, label, hint from mart.ui_item_day_filters
                    where account_id = %s and filter_type = 'brand' and calendar_date between %s and %s
                ),
                articles as (
                    select distinct value, label, hint from mart.ui_item_day_filters
                    where account_id = %s and filter_type = 'article' and calendar_date between %s and %s
                )
                select
                    coalesce((select json_agg(json_build_object('value', value, 'label', label, 'hint', hint) order by label) from subjects), '[]'::json) as subjects,
                    coalesce((select json_agg(json_build_object('value', value, 'label', value, 'hint', null) order by value) from brands), '[]'::json) as brands,
                    coalesce((select json_agg(json_build_object('value', value, 'label', label, 'hint', hint) order by label) from articles), '[]'::json) as articles
                """,
                (account_id, date_from, date_to, account_id, date_from, date_to, account_id, date_from, date_to),
            )
            row = await cur.fetchone() or {'subjects': [], 'brands': [], 'articles': []}
            elapsed_ms = (perf_counter() - started_at) * 1000
            print(f'economics_filter_options_timing account_id={account_id} elapsed_ms={elapsed_ms:.1f}')
            return row

    async def get_advert_diagnostics_totals(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> dict:
        async with self._conn.cursor() as cur:
            await cur.execute(
                """
                with raw_totals as (
                    select coalesce(sum(coalesce(upd_sum, 0)), 0)::numeric as raw_advert_cost
                    from core.advert_costs
                    where account_id = %s
                      and upd_time::date between %s and %s
                ),
                sku_totals as (
                    select coalesce(sum(coalesce(advert_cost, 0)), 0)::numeric as sku_advert_cost
                    from mart.ui_item_day
                    where account_id = %s
                      and calendar_date between %s and %s
                )
                select
                    raw_totals.raw_advert_cost,
                    sku_totals.sku_advert_cost,
                    (raw_totals.raw_advert_cost - sku_totals.sku_advert_cost)::numeric as unattributed_advert_cost
                from raw_totals, sku_totals
                """,
                (
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                ),
            )
            return await cur.fetchone() or {}

    async def list_advert_diagnostic_campaigns(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> list[dict]:
        async with self._conn.cursor() as cur:
            await cur.execute(
                """
                with raw_by_advert as (
                    select
                        ac.account_id,
                        ac.advert_id,
                        sum(coalesce(ac.upd_sum, 0))::numeric as raw_advert_cost
                    from core.advert_costs ac
                    where ac.account_id = %s
                      and ac.upd_time::date between %s and %s
                    group by ac.account_id, ac.advert_id
                ),
                alloc_by_advert as (
                    select
                        aca.account_id,
                        aca.advert_id,
                        sum(
                            case
                                when aca.vendor_code is null or btrim(aca.vendor_code) = '' then 0
                                else coalesce(aca.allocated_upd_sum, 0)
                            end
                        )::numeric as sku_advert_cost
                    from core.advert_cost_allocations aca
                    where aca.account_id = %s
                      and aca.upd_time::date between %s and %s
                    group by aca.account_id, aca.advert_id
                ),
                advert_mapping as (
                    select
                        anv.account_id,
                        anv.advert_id,
                        count(distinct anv.nm_id)::int as sku_count,
                        count(
                            distinct case
                                when anv.vendor_code is null or btrim(anv.vendor_code) = '' then null
                                else anv.nm_id
                            end
                        )::int as sku_with_vendor_code_count
                    from core.advert_nms_with_vendor_code anv
                    where anv.account_id = %s
                    group by anv.account_id, anv.advert_id
                )
                select
                    r.advert_id,
                    a.campaign_name,
                    r.raw_advert_cost,
                    coalesce(ab.sku_advert_cost, 0)::numeric as sku_advert_cost,
                    (r.raw_advert_cost - coalesce(ab.sku_advert_cost, 0))::numeric as unattributed_advert_cost,
                    coalesce(am.sku_count, 0)::int as sku_count,
                    coalesce(am.sku_with_vendor_code_count, 0)::int as sku_with_vendor_code_count,
                    case
                        when coalesce(am.sku_count, 0) = 0 then 'no_sku_mapping'
                        when coalesce(am.sku_with_vendor_code_count, 0) = 0 then 'missing_vendor_code'
                        when r.raw_advert_cost > coalesce(ab.sku_advert_cost, 0) then 'partially_unattributed'
                        else 'mapped'
                    end as status
                from raw_by_advert r
                left join alloc_by_advert ab
                  on ab.account_id = r.account_id
                 and ab.advert_id = r.advert_id
                left join advert_mapping am
                  on am.account_id = r.account_id
                 and am.advert_id = r.advert_id
                left join core.adverts a
                  on a.account_id = r.account_id
                 and a.advert_id = r.advert_id
                where (r.raw_advert_cost - coalesce(ab.sku_advert_cost, 0)) > 0
                order by unattributed_advert_cost desc, r.advert_id desc
                """,
                (
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                ),
            )
            return list(await cur.fetchall())
