create schema if not exists mart;

create or replace view mart.sku_unit_economics_day_current as
with primary_photos as (
    select
        p.account_id,
        p.nm_id,
        p.photo_url
    from core.product_card_photos p
    where p.photo_index = 1
)
select
    f.account_id,
    f.calendar_date,
    f.week_start,
    f.nm_id,
    f.vendor_code,
    f.ts_name,
    f.brand_name,
    f.subject_name,
    f.bonus_type_name,
    acc.name as account_name,
    pp.photo_url,
    (coalesce(f.sales_quantity, 0) - coalesce(f.return_quantity, 0))::bigint as sales_quantity,
    f.return_quantity,
    f.retail_price_sale,
    f.retail_price_return,
    f.realization_before_spp,
    f.retail_amount_sale,
    f.retail_amount_return,
    f.realization_after_spp,
    f.spp_amount,
    f.spp_percent,
    f.ppvz_for_pay_sale,
    f.ppvz_for_pay_return,
    f.seller_transfer,
    f.delivery_quantity,
    f.refusal_quantity,
    f.delivery_cost,
    f.penalty_cost,
    f.cashback_amount,
    f.paid_storage_cost,
    f.wb_commission_amount,
    f.wb_commission_percent,
    f.buyout_percent,
    f.tax_amount,
    f.cogs_amount,
    f.profit_amount,
    f.margin_percent,
    f.roi_percent
from mart.fact_unit_economics_day_size_current f
left join core.accounts acc
  on acc.account_id = f.account_id
left join primary_photos pp
  on pp.account_id = f.account_id
 and pp.nm_id = f.nm_id;


