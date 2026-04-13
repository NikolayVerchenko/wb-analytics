create schema if not exists mart;

create table if not exists mart.ui_item_day (
    source_mode text not null,
    account_id uuid not null,
    calendar_date date not null,
    week_start date,
    nm_id integer not null,
    vendor_code text not null,
    brand_name text,
    subject_name text,
    bonus_type_name text,
    account_name text,
    photo_url text,
    order_count bigint,
    sales_quantity bigint,
    return_quantity bigint,
    retail_price_sale numeric,
    retail_price_return numeric,
    realization_before_spp numeric,
    retail_amount_sale numeric,
    retail_amount_return numeric,
    realization_after_spp numeric,
    spp_amount numeric,
    spp_percent numeric,
    ppvz_for_pay_sale numeric,
    ppvz_for_pay_return numeric,
    seller_transfer numeric,
    delivery_quantity numeric,
    refusal_quantity numeric,
    buyout_percent numeric,
    delivery_cost_base numeric,
    delivery_cost_correction numeric,
    delivery_cost numeric,
    penalty_cost numeric,
    cashback_amount numeric,
    paid_storage_cost numeric,
    advert_cost numeric,
    acceptance_cost numeric,
    wb_commission_amount numeric,
    wb_commission_percent numeric,
    tax_amount numeric,
    cogs_amount numeric,
    profit_amount numeric,
    margin_percent numeric,
    roi_percent numeric
);

alter table mart.ui_item_day
    add column if not exists delivery_cost_base numeric,
    add column if not exists delivery_cost_correction numeric;

alter table mart.ui_item_day
    add column if not exists order_count bigint;

create unique index if not exists ui_item_day_pk
    on mart.ui_item_day (account_id, calendar_date, nm_id, vendor_code);

create index if not exists ui_item_day_account_date_idx
    on mart.ui_item_day (account_id, calendar_date);

create index if not exists ui_item_day_account_date_vendor_idx
    on mart.ui_item_day (account_id, calendar_date, vendor_code);

create index if not exists ui_item_day_account_date_subject_idx
    on mart.ui_item_day (account_id, calendar_date, subject_name);

create index if not exists ui_item_day_account_date_brand_idx
    on mart.ui_item_day (account_id, calendar_date, brand_name);

truncate table mart.ui_item_day;

insert into mart.ui_item_day (
    source_mode,
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
    order_count,
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
    delivery_cost_base,
    delivery_cost_correction,
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
)
with size_rollup as (
    select
        case when count(distinct source_mode) = 1 then max(source_mode) else 'mixed' end as source_mode,
        account_id,
        calendar_date,
        min(week_start) as week_start,
        nm_id,
        btrim(lower(coalesce(vendor_code, ''))) as vendor_code,
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
        sum(coalesce(wb_commission_amount, 0))::numeric as wb_commission_amount,
        case
            when sum(coalesce(realization_before_spp, 0)) = 0 then null
            else round((sum(coalesce(wb_commission_amount, 0)) / sum(coalesce(realization_before_spp, 0))) * 100, 2)
        end::numeric as wb_commission_percent,
        sum(coalesce(tax_amount, 0))::numeric as tax_amount,
        sum(coalesce(cogs_amount, 0))::numeric as cogs_amount,
        sum(coalesce(profit_amount, 0))::numeric as size_profit_amount
    from mart.ui_item_size_day
    group by account_id, calendar_date, nm_id, vendor_code
),
item_extras_closed_dates as (
    select distinct account_id, calendar_date
    from mart.sku_unit_economics_day_item_closed
),
item_extras_source as (
    select
        'closed'::text as source_mode,
        c.account_id,
        c.calendar_date,
        c.week_start,
        c.nm_id,
        btrim(lower(coalesce(c.vendor_code, ''))) as vendor_code,
        c.brand_name,
        c.subject_name,
        c.bonus_type_name,
        c.account_name,
        c.photo_url,
        c.advert_cost,
        c.acceptance_cost
    from mart.sku_unit_economics_day_item_closed c

    union all

    select
        'current'::text as source_mode,
        c.account_id,
        c.calendar_date,
        c.week_start,
        c.nm_id,
        btrim(lower(coalesce(c.vendor_code, ''))) as vendor_code,
        c.brand_name,
        c.subject_name,
        c.bonus_type_name,
        c.account_name,
        c.photo_url,
        c.advert_cost,
        c.acceptance_cost
    from mart.sku_unit_economics_day_item_current c
    where not exists (
        select 1
        from item_extras_closed_dates cd
        where cd.account_id = c.account_id
          and cd.calendar_date = c.calendar_date
    )
),
item_extras as (
    select
        case when count(distinct source_mode) = 1 then max(source_mode) else 'mixed' end as source_mode,
        account_id,
        calendar_date,
        min(week_start) as week_start,
        nm_id,
        vendor_code,
        max(brand_name) as brand_name,
        max(subject_name) as subject_name,
        string_agg(distinct nullif(btrim(bonus_type_name), ''), '; ') as bonus_type_name,
        max(account_name) as account_name,
        max(photo_url) as photo_url,
        sum(coalesce(advert_cost, 0))::numeric as advert_cost,
        sum(coalesce(acceptance_cost, 0))::numeric as acceptance_cost
    from item_extras_source
    group by account_id, calendar_date, nm_id, vendor_code
),
funnel_orders as (
    select
        'funnel'::text as source_mode,
        account_id,
        period_from as calendar_date,
        nm_id,
        btrim(lower(coalesce(vendor_code, ''))) as vendor_code,
        max(brand_name) as brand_name,
        max(subject_name) as subject_name,
        sum(coalesce(order_count, 0))::bigint as order_count
    from core.product_funnel
    where period_from = period_to
    group by account_id, period_from, nm_id, btrim(lower(coalesce(vendor_code, '')))
),
base_keys as (
    select account_id, calendar_date, nm_id, vendor_code from size_rollup
    union
    select account_id, calendar_date, nm_id, vendor_code from item_extras
    union
    select account_id, calendar_date, nm_id, vendor_code from funnel_orders
)
select
    coalesce(sr.source_mode, ix.source_mode, fo.source_mode, 'serving') as source_mode,
    bk.account_id,
    bk.calendar_date,
    coalesce(sr.week_start, ix.week_start) as week_start,
    bk.nm_id,
    bk.vendor_code,
    coalesce(sr.brand_name, ix.brand_name, fo.brand_name) as brand_name,
    coalesce(sr.subject_name, ix.subject_name, fo.subject_name) as subject_name,
    coalesce(sr.bonus_type_name, ix.bonus_type_name) as bonus_type_name,
    coalesce(sr.account_name, ix.account_name) as account_name,
    coalesce(sr.photo_url, ix.photo_url) as photo_url,
    coalesce(fo.order_count, 0)::bigint as order_count,
    coalesce(sr.sales_quantity, 0)::bigint as sales_quantity,
    coalesce(sr.return_quantity, 0)::bigint as return_quantity,
    coalesce(sr.retail_price_sale, 0)::numeric as retail_price_sale,
    coalesce(sr.retail_price_return, 0)::numeric as retail_price_return,
    coalesce(sr.realization_before_spp, 0)::numeric as realization_before_spp,
    coalesce(sr.retail_amount_sale, 0)::numeric as retail_amount_sale,
    coalesce(sr.retail_amount_return, 0)::numeric as retail_amount_return,
    coalesce(sr.realization_after_spp, 0)::numeric as realization_after_spp,
    coalesce(sr.spp_amount, 0)::numeric as spp_amount,
    sr.spp_percent,
    coalesce(sr.ppvz_for_pay_sale, 0)::numeric as ppvz_for_pay_sale,
    coalesce(sr.ppvz_for_pay_return, 0)::numeric as ppvz_for_pay_return,
    coalesce(sr.seller_transfer, 0)::numeric as seller_transfer,
    coalesce(sr.delivery_quantity, 0)::numeric as delivery_quantity,
    coalesce(sr.refusal_quantity, 0)::numeric as refusal_quantity,
    sr.buyout_percent,
    coalesce(sr.delivery_cost_base, 0)::numeric as delivery_cost_base,
    coalesce(sr.delivery_cost_correction, 0)::numeric as delivery_cost_correction,
    coalesce(sr.delivery_cost, 0)::numeric as delivery_cost,
    coalesce(sr.penalty_cost, 0)::numeric as penalty_cost,
    coalesce(sr.cashback_amount, 0)::numeric as cashback_amount,
    coalesce(sr.paid_storage_cost, 0)::numeric as paid_storage_cost,
    coalesce(ix.advert_cost, 0)::numeric as advert_cost,
    coalesce(ix.acceptance_cost, 0)::numeric as acceptance_cost,
    coalesce(sr.wb_commission_amount, 0)::numeric as wb_commission_amount,
    sr.wb_commission_percent,
    coalesce(sr.tax_amount, 0)::numeric as tax_amount,
    coalesce(sr.cogs_amount, 0)::numeric as cogs_amount,
    (coalesce(sr.size_profit_amount, 0) - coalesce(ix.advert_cost, 0) - coalesce(ix.acceptance_cost, 0))::numeric as profit_amount,
    case
        when coalesce(sr.realization_before_spp, 0) = 0 then null
        else round((((coalesce(sr.size_profit_amount, 0) - coalesce(ix.advert_cost, 0) - coalesce(ix.acceptance_cost, 0)) / sr.realization_before_spp) * 100), 2)
    end::numeric as margin_percent,
    case
        when coalesce(sr.cogs_amount, 0) = 0 then null
        else round((((coalesce(sr.size_profit_amount, 0) - coalesce(ix.advert_cost, 0) - coalesce(ix.acceptance_cost, 0)) / sr.cogs_amount) * 100), 2)
    end::numeric as roi_percent
from base_keys bk
left join size_rollup sr
  on sr.account_id = bk.account_id
 and sr.calendar_date = bk.calendar_date
 and sr.nm_id = bk.nm_id
 and sr.vendor_code = bk.vendor_code
left join item_extras ix
  on ix.account_id = bk.account_id
 and ix.calendar_date = bk.calendar_date
 and ix.nm_id = bk.nm_id
 and ix.vendor_code = bk.vendor_code
left join funnel_orders fo
  on fo.account_id = bk.account_id
 and fo.calendar_date = bk.calendar_date
 and fo.nm_id = bk.nm_id
 and fo.vendor_code = bk.vendor_code
where not (
    coalesce(fo.order_count, 0) = 0
    and coalesce(sr.sales_quantity, 0) = 0
    and coalesce(sr.return_quantity, 0) = 0
    and coalesce(sr.retail_price_sale, 0) = 0
    and coalesce(sr.retail_price_return, 0) = 0
    and coalesce(sr.realization_before_spp, 0) = 0
    and coalesce(sr.retail_amount_sale, 0) = 0
    and coalesce(sr.retail_amount_return, 0) = 0
    and coalesce(sr.realization_after_spp, 0) = 0
    and coalesce(sr.spp_amount, 0) = 0
    and coalesce(sr.ppvz_for_pay_sale, 0) = 0
    and coalesce(sr.ppvz_for_pay_return, 0) = 0
    and coalesce(sr.seller_transfer, 0) = 0
    and coalesce(sr.delivery_quantity, 0) = 0
    and coalesce(sr.refusal_quantity, 0) = 0
    and coalesce(sr.delivery_cost, 0) = 0
    and coalesce(sr.penalty_cost, 0) = 0
    and coalesce(sr.cashback_amount, 0) = 0
    and coalesce(sr.paid_storage_cost, 0) = 0
    and coalesce(ix.advert_cost, 0) = 0
    and coalesce(ix.acceptance_cost, 0) = 0
    and coalesce(sr.wb_commission_amount, 0) = 0
    and coalesce(sr.tax_amount, 0) = 0
    and coalesce(sr.cogs_amount, 0) = 0
    and coalesce(sr.size_profit_amount, 0) = 0
);
