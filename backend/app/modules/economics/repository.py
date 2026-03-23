from datetime import date
from decimal import Decimal
from uuid import UUID

import psycopg


class EconomicsRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

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
            with closed_dates as (
                -- ensure predicate pushdown for views
                select distinct calendar_date
                from mart.sku_unit_economics_day_item_closed
                where account_id = %s
                  and calendar_date between %s and %s
            ),
            all_items as (
                select
                    'closed'::text as source_mode,
                    account_id,
                    calendar_date,
                    week_start,
                    nm_id,
                    vendor_code,
                    brand_name,
                    subject_name,
                    bonus_type_name,
                    account_name,
                    photo_url,
                    sales_quantity,
                    return_quantity,
                    retail_price_sale,
                    retail_price_return,
                    realization_before_spp,
                    retail_amount_sale,
                    retail_amount_return,
                    realization_after_spp,
                    spp_amount,
                    spp_percent,
                    ppvz_for_pay_sale,
                    ppvz_for_pay_return,
                    seller_transfer,
                    delivery_quantity,
                    refusal_quantity,
                    buyout_percent,
                    delivery_cost,
                    penalty_cost,
                    cashback_amount,
                    paid_storage_cost,
                    advert_cost,
                    acceptance_cost,
                    wb_commission_amount,
                    wb_commission_percent,
                    tax_amount,
                    cogs_amount,
                    profit_amount,
                    margin_percent,
                    roi_percent
                from mart.sku_unit_economics_day_item_closed
                where account_id = %s
                  and calendar_date between %s and %s

                union all

                select
                    'current'::text as source_mode,
                    account_id,
                    calendar_date,
                    week_start,
                    nm_id,
                    vendor_code,
                    brand_name,
                    subject_name,
                    bonus_type_name,
                    account_name,
                    photo_url,
                    sales_quantity,
                    return_quantity,
                    retail_price_sale,
                    retail_price_return,
                    realization_before_spp,
                    retail_amount_sale,
                    retail_amount_return,
                    realization_after_spp,
                    spp_amount,
                    spp_percent,
                    ppvz_for_pay_sale,
                    ppvz_for_pay_return,
                    seller_transfer,
                    delivery_quantity,
                    refusal_quantity,
                    buyout_percent,
                    delivery_cost,
                    penalty_cost,
                    cashback_amount,
                    paid_storage_cost,
                    advert_cost,
                    acceptance_cost,
                    wb_commission_amount,
                    wb_commission_percent,
                    tax_amount,
                    cogs_amount,
                    profit_amount,
                    margin_percent,
                    roi_percent
                from mart.sku_unit_economics_day_item_current
                where account_id = %s
                  and calendar_date between %s and %s
                  and not exists (
                    select 1
                    from closed_dates cd
                    where cd.calendar_date = mart.sku_unit_economics_day_item_current.calendar_date
                  )
            ),
            aggregated as (
                select
                    case when count(distinct source_mode) = 1 then max(source_mode) else 'mixed' end as source_mode,
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
                from all_items
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
            account_id,
            date_from,
            date_to,
            account_id,
            date_from,
            date_to,
            account_id,
            date_from,
            date_to,
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

    @staticmethod
    def _totals_select_sql() -> str:
        return """
            , totals as (
                select
                    coalesce(sum(coalesce(sales_quantity, 0)), 0)::numeric as sales_quantity,
                    coalesce(sum(coalesce(delivery_quantity, 0)), 0)::numeric as delivery_quantity,
                    coalesce(sum(coalesce(refusal_quantity, 0)), 0)::numeric as refusal_quantity,
                    coalesce(sum(coalesce(realization_before_spp, 0)), 0)::numeric as realization_before_spp,
                    coalesce(sum(coalesce(realization_after_spp, 0)), 0)::numeric as realization_after_spp,
                    coalesce(sum(coalesce(spp_amount, 0)), 0)::numeric as spp_amount,
                    coalesce(sum(coalesce(seller_transfer, 0)), 0)::numeric as seller_transfer,
                    coalesce(sum(coalesce(wb_commission_amount, 0)), 0)::numeric as wb_commission_amount,
                    coalesce(sum(coalesce(advert_cost, 0)), 0)::numeric as advert_cost,
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
                sales_quantity,
                delivery_quantity,
                refusal_quantity,
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

    def list_period_items(
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
        with self._conn.cursor() as cur:
            base_sql, base_params = self._build_period_items_base_query(
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
            totals_sql = base_sql + self._totals_select_sql()
            cur.execute(totals_sql, base_params)
            totals_row = cur.fetchone() or {}

            items_sql = (
                base_sql
                + f"""
                select *
                from filtered
                order by {order_by}
                limit %s
                offset %s
                """
            )
            cur.execute(items_sql, base_params + (limit, offset))
            return list(cur.fetchall()), totals_row

    def get_period_totals(
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
        with self._conn.cursor() as cur:
            base_sql, base_params = self._build_period_items_base_query(
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
            cur.execute(base_sql + self._totals_select_sql(), base_params)
            return cur.fetchone() or {}

    def list_period_sizes(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
        nm_id: int,
        vendor_code: str,
    ) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                with closed_dates as (
                    -- ensure predicate pushdown for views
                    select distinct calendar_date
                    from mart.sku_unit_economics_day_closed
                    where account_id = %s
                      and calendar_date between %s and %s
                ),
                all_sizes as (
                    select
                        'closed'::text as source_mode,
                        account_id,
                        calendar_date,
                        week_start,
                        nm_id,
                        vendor_code,
                        ts_name,
                        brand_name,
                        subject_name,
                        bonus_type_name,
                        account_name,
                        photo_url,
                        sales_quantity,
                        return_quantity,
                        retail_price_sale,
                        retail_price_return,
                        realization_before_spp,
                        retail_amount_sale,
                        retail_amount_return,
                        realization_after_spp,
                        spp_amount,
                        spp_percent,
                        ppvz_for_pay_sale,
                        ppvz_for_pay_return,
                        seller_transfer,
                        delivery_quantity,
                        refusal_quantity,
                        buyout_percent,
                        delivery_cost,
                        penalty_cost,
                        cashback_amount,
                        paid_storage_cost,
                        wb_commission_amount,
                        wb_commission_percent,
                        tax_amount,
                        cogs_amount,
                        profit_amount,
                        margin_percent,
                        roi_percent
                    from mart.sku_unit_economics_day_closed
                    where account_id = %s
                      and calendar_date between %s and %s
                      and nm_id = %s
                      and vendor_code = %s

                    union all

                    select
                        'current'::text as source_mode,
                        account_id,
                        calendar_date,
                        week_start,
                        nm_id,
                        vendor_code,
                        ts_name,
                        brand_name,
                        subject_name,
                        bonus_type_name,
                        account_name,
                        photo_url,
                        sales_quantity,
                        return_quantity,
                        retail_price_sale,
                        retail_price_return,
                        realization_before_spp,
                        retail_amount_sale,
                        retail_amount_return,
                        realization_after_spp,
                        spp_amount,
                        spp_percent,
                        ppvz_for_pay_sale,
                        ppvz_for_pay_return,
                        seller_transfer,
                        delivery_quantity,
                        refusal_quantity,
                        buyout_percent,
                        delivery_cost,
                        penalty_cost,
                        cashback_amount,
                        paid_storage_cost,
                        wb_commission_amount,
                        wb_commission_percent,
                        tax_amount,
                        cogs_amount,
                        profit_amount,
                        margin_percent,
                        roi_percent
                    from mart.sku_unit_economics_day_current
                    where account_id = %s
                      and calendar_date between %s and %s
                      and nm_id = %s
                      and vendor_code = %s
                      and not exists (
                        select 1
                        from closed_dates cd
                        where cd.calendar_date = mart.sku_unit_economics_day_current.calendar_date
                      )
                )
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
                from all_sizes
                group by account_id, nm_id, vendor_code, ts_name
                order by ts_name nulls first
                """,
                (
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                    nm_id,
                    vendor_code,
                    account_id,
                    date_from,
                    date_to,
                    nm_id,
                    vendor_code,
                    date_from,
                    date_to,
                ),
            )
            return list(cur.fetchall())


    def list_filter_options(
        self,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                with closed_dates as (
                    select distinct calendar_date
                    from mart.sku_unit_economics_day_item_closed
                    where account_id = %s
                      and calendar_date between %s and %s
                ),
                all_items as (
                    select
                        subject_name,
                        brand_name,
                        vendor_code,
                        nm_id
                    from mart.sku_unit_economics_day_item_closed
                    where account_id = %s
                      and calendar_date between %s and %s

                    union all

                    select
                        subject_name,
                        brand_name,
                        vendor_code,
                        nm_id
                    from mart.sku_unit_economics_day_item_current
                    where account_id = %s
                      and calendar_date between %s and %s
                      and not exists (
                        select 1
                        from closed_dates cd
                        where cd.calendar_date = mart.sku_unit_economics_day_item_current.calendar_date
                      )
                ),
                subjects as (
                    select distinct btrim(subject_name) as value
                    from all_items
                    where nullif(btrim(subject_name), '') is not null
                ),
                brands as (
                    select distinct btrim(brand_name) as value
                    from all_items
                    where nullif(btrim(brand_name), '') is not null
                ),
                articles as (
                    select
                        btrim(vendor_code) as value,
                        btrim(vendor_code) as label,
                        nm_id::text as hint,
                        row_number() over (
                            partition by btrim(vendor_code)
                            order by nm_id nulls last
                        ) as rn
                    from all_items
                    where nullif(btrim(vendor_code), '') is not null
                )
                select
                    coalesce(
                        (
                            select json_agg(json_build_object('value', value, 'label', value, 'hint', null) order by value)
                            from subjects
                        ),
                        '[]'::json
                    ) as subjects,
                    coalesce(
                        (
                            select json_agg(json_build_object('value', value, 'label', value, 'hint', null) order by value)
                            from brands
                        ),
                        '[]'::json
                    ) as brands,
                    coalesce(
                        (
                            select json_agg(json_build_object('value', value, 'label', label, 'hint', hint) order by label)
                            from articles
                            where rn = 1
                        ),
                        '[]'::json
                    ) as articles
                """,
                (
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                    account_id,
                    date_from,
                    date_to,
                ),
            )
            return cur.fetchone() or {'subjects': [], 'brands': [], 'articles': []}
