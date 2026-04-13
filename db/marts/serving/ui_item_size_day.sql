create schema if not exists mart;

create table if not exists mart.ui_item_size_day (
    source_mode text not null,
    account_id uuid not null,
    calendar_date date not null,
    week_start date,
    nm_id integer not null,
    vendor_code text not null,
    ts_name text not null,
    brand_name text,
    subject_name text,
    bonus_type_name text,
    account_name text,
    photo_url text,
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
    wb_commission_amount numeric,
    wb_commission_percent numeric,
    tax_amount numeric,
    cogs_amount numeric,
    profit_amount numeric,
    margin_percent numeric,
    roi_percent numeric
);

alter table mart.ui_item_size_day
    add column if not exists delivery_cost_base numeric,
    add column if not exists delivery_cost_correction numeric;

create unique index if not exists ui_item_size_day_pk
    on mart.ui_item_size_day (account_id, calendar_date, nm_id, vendor_code, ts_name);

create index if not exists ui_item_size_day_account_date_idx
    on mart.ui_item_size_day (account_id, calendar_date);

create index if not exists ui_item_size_day_account_date_vendor_idx
    on mart.ui_item_size_day (account_id, calendar_date, vendor_code);

create index if not exists ui_item_size_day_account_date_nm_idx
    on mart.ui_item_size_day (account_id, calendar_date, nm_id);

create index if not exists ui_item_size_day_drilldown_idx
    on mart.ui_item_size_day (account_id, nm_id, vendor_code, calendar_date);

truncate table mart.ui_item_size_day;

insert into mart.ui_item_size_day (
    source_mode,
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
    delivery_cost_base,
    delivery_cost_correction,
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
)
with current_week as (
    select date_trunc('week', current_date)::date as week_start
),
closed_keys as (
    select distinct
        account_id,
        calendar_date,
        nm_id,
        btrim(lower(coalesce(vendor_code, ''))) as vendor_code,
        btrim(upper(coalesce(ts_name, ''))) as ts_name
    from mart.sku_unit_economics_day_closed
    where not (
        coalesce(sales_quantity, 0) = 0
        and coalesce(return_quantity, 0) = 0
        and coalesce(retail_price_sale, 0) = 0
        and coalesce(retail_price_return, 0) = 0
        and coalesce(realization_before_spp, 0) = 0
        and coalesce(retail_amount_sale, 0) = 0
        and coalesce(retail_amount_return, 0) = 0
        and coalesce(realization_after_spp, 0) = 0
        and coalesce(spp_amount, 0) = 0
        and coalesce(ppvz_for_pay_sale, 0) = 0
        and coalesce(ppvz_for_pay_return, 0) = 0
        and coalesce(seller_transfer, 0) = 0
        and coalesce(delivery_quantity, 0) = 0
        and coalesce(refusal_quantity, 0) = 0
        and coalesce(delivery_cost, 0) = 0
        and coalesce(penalty_cost, 0) = 0
        and coalesce(cashback_amount, 0) = 0
        and coalesce(paid_storage_cost, 0) = 0
        and coalesce(wb_commission_amount, 0) = 0
        and coalesce(tax_amount, 0) = 0
        and coalesce(cogs_amount, 0) = 0
        and coalesce(profit_amount, 0) = 0
    )
),
all_rows as (
    select
        'closed'::text as source_mode,
        c.account_id,
        c.calendar_date,
        c.week_start,
        c.nm_id,
        btrim(lower(coalesce(c.vendor_code, ''))) as vendor_code,
        btrim(upper(coalesce(c.ts_name, ''))) as ts_name,
        c.brand_name,
        c.subject_name,
        c.bonus_type_name,
        c.account_name,
        c.photo_url,
        c.sales_quantity,
        c.return_quantity,
        c.retail_price_sale,
        c.retail_price_return,
        c.realization_before_spp,
        c.retail_amount_sale,
        c.retail_amount_return,
        c.realization_after_spp,
        c.spp_amount,
        c.spp_percent,
        c.ppvz_for_pay_sale,
        c.ppvz_for_pay_return,
        c.seller_transfer,
        c.delivery_quantity,
        c.refusal_quantity,
        c.buyout_percent,
        c.delivery_cost_base,
        c.delivery_cost_correction,
        c.delivery_cost,
        c.penalty_cost,
        c.cashback_amount,
        c.paid_storage_cost,
        c.wb_commission_amount,
        c.wb_commission_percent,
        c.tax_amount,
        c.cogs_amount,
        c.profit_amount,
        c.margin_percent,
        c.roi_percent
    from mart.sku_unit_economics_day_closed c
    cross join current_week cw
    where c.calendar_date < cw.week_start

    union all

    select
        'current'::text as source_mode,
        c.account_id,
        c.calendar_date,
        c.week_start,
        c.nm_id,
        btrim(lower(coalesce(c.vendor_code, ''))) as vendor_code,
        btrim(upper(coalesce(c.ts_name, ''))) as ts_name,
        c.brand_name,
        c.subject_name,
        c.bonus_type_name,
        c.account_name,
        c.photo_url,
        c.sales_quantity,
        c.return_quantity,
        c.retail_price_sale,
        c.retail_price_return,
        c.realization_before_spp,
        c.retail_amount_sale,
        c.retail_amount_return,
        c.realization_after_spp,
        c.spp_amount,
        c.spp_percent,
        c.ppvz_for_pay_sale,
        c.ppvz_for_pay_return,
        c.seller_transfer,
        c.delivery_quantity,
        c.refusal_quantity,
        c.buyout_percent,
        c.delivery_cost_base,
        c.delivery_cost_correction,
        c.delivery_cost,
        c.penalty_cost,
        c.cashback_amount,
        c.paid_storage_cost,
        c.wb_commission_amount,
        c.wb_commission_percent,
        c.tax_amount,
        c.cogs_amount,
        c.profit_amount,
        c.margin_percent,
        c.roi_percent
    from mart.sku_unit_economics_day_current c
    cross join current_week cw
    where c.calendar_date >= cw.week_start
       or not exists (
            select 1
            from closed_keys ck
            where ck.account_id = c.account_id
              and ck.calendar_date = c.calendar_date
              and ck.nm_id = c.nm_id
              and ck.vendor_code = btrim(lower(coalesce(c.vendor_code, '')))
              and ck.ts_name = btrim(upper(coalesce(c.ts_name, '')))
        )
)
select
    case when count(distinct source_mode) = 1 then max(source_mode) else 'mixed' end as source_mode,
    account_id,
    calendar_date,
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
from all_rows
group by account_id, calendar_date, nm_id, vendor_code, ts_name
having not (
    sum(coalesce(sales_quantity, 0)) = 0
    and sum(coalesce(return_quantity, 0)) = 0
    and sum(coalesce(retail_price_sale, 0)) = 0
    and sum(coalesce(retail_price_return, 0)) = 0
    and sum(coalesce(realization_before_spp, 0)) = 0
    and sum(coalesce(retail_amount_sale, 0)) = 0
    and sum(coalesce(retail_amount_return, 0)) = 0
    and sum(coalesce(realization_after_spp, 0)) = 0
    and sum(coalesce(spp_amount, 0)) = 0
    and sum(coalesce(ppvz_for_pay_sale, 0)) = 0
    and sum(coalesce(ppvz_for_pay_return, 0)) = 0
    and sum(coalesce(seller_transfer, 0)) = 0
    and sum(coalesce(delivery_quantity, 0)) = 0
    and sum(coalesce(refusal_quantity, 0)) = 0
    and sum(coalesce(delivery_cost, 0)) = 0
    and sum(coalesce(penalty_cost, 0)) = 0
    and sum(coalesce(cashback_amount, 0)) = 0
    and sum(coalesce(paid_storage_cost, 0)) = 0
    and sum(coalesce(wb_commission_amount, 0)) = 0
    and sum(coalesce(tax_amount, 0)) = 0
    and sum(coalesce(cogs_amount, 0)) = 0
    and sum(coalesce(profit_amount, 0)) = 0
);
