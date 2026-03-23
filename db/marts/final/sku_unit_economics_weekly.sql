create schema if not exists mart;

create or replace view mart.sku_unit_economics_weekly as
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
    f.week_start,
    f.nm_id,
    f.vendor_code,
    f.ts_name,
    f.brand_name,
    f.subject_name,
    acc.name as account_name,
    pp.photo_url,
    f.sales_quantity,
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
    f.wb_commission_amount,
    f.wb_commission_percent
from mart.fact_unit_economics_weekly_size_closed f
left join core.accounts acc
  on acc.account_id = f.account_id
left join primary_photos pp
  on pp.account_id = f.account_id
 and pp.nm_id = f.nm_id;
