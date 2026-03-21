create schema if not exists mart;

create or replace view mart.sku_unit_economics_day_item_current as
with acceptance_base as (
    select
        ac.account_id,
        ac.gi_create_date as calendar_date,
        ac.nm_id,
        sum(coalesce(ac.total_cost, 0))::numeric as acceptance_cost
    from core.acceptance_costs ac
    where ac.gi_create_date is not null
      and ac.nm_id is not null
    group by
        ac.account_id,
        ac.gi_create_date,
        ac.nm_id
)
select
    s.account_id,
    s.calendar_date,
    s.week_start,
    s.nm_id,
    s.vendor_code,
    max(s.brand_name) as brand_name,
    max(s.subject_name) as subject_name,
    max(s.bonus_type_name) as bonus_type_name,
    acc.name as account_name,
    pp.photo_url,
    sum(coalesce(s.sales_quantity, 0))::bigint as sales_quantity,
    sum(coalesce(s.return_quantity, 0))::bigint as return_quantity,
    sum(coalesce(s.retail_price_sale, 0))::numeric as retail_price_sale,
    sum(coalesce(s.retail_price_return, 0))::numeric as retail_price_return,
    sum(coalesce(s.realization_before_spp, 0))::numeric as realization_before_spp,
    sum(coalesce(s.retail_amount_sale, 0))::numeric as retail_amount_sale,
    sum(coalesce(s.retail_amount_return, 0))::numeric as retail_amount_return,
    sum(coalesce(s.realization_after_spp, 0))::numeric as realization_after_spp,
    sum(coalesce(s.spp_amount, 0))::numeric as spp_amount,
    case
        when sum(coalesce(s.realization_before_spp, 0)) = 0 then null
        else round((sum(coalesce(s.spp_amount, 0)) / sum(coalesce(s.realization_before_spp, 0))) * 100, 2)
    end::numeric as spp_percent,
    sum(coalesce(s.ppvz_for_pay_sale, 0))::numeric as ppvz_for_pay_sale,
    sum(coalesce(s.ppvz_for_pay_return, 0))::numeric as ppvz_for_pay_return,
    sum(coalesce(s.seller_transfer, 0))::numeric as seller_transfer,
    sum(coalesce(s.delivery_quantity, 0))::numeric as delivery_quantity,
    sum(coalesce(s.refusal_quantity, 0))::numeric as refusal_quantity,
    sum(coalesce(s.delivery_cost, 0))::numeric as delivery_cost,
    sum(coalesce(s.penalty_cost, 0))::numeric as penalty_cost,
    sum(coalesce(s.cashback_amount, 0))::numeric as cashback_amount,
    sum(coalesce(s.paid_storage_cost, 0))::numeric as paid_storage_cost,
    coalesce(ab.advert_cost, 0)::numeric as advert_cost,
    coalesce(acb.acceptance_cost, 0)::numeric as acceptance_cost,
    sum(coalesce(s.wb_commission_amount, 0))::numeric as wb_commission_amount,
    case
        when sum(coalesce(s.realization_before_spp, 0)) = 0 then null
        else round((sum(coalesce(s.wb_commission_amount, 0)) / sum(coalesce(s.realization_before_spp, 0))) * 100, 2)
    end::numeric as wb_commission_percent,
    case
        when sum(coalesce(s.delivery_quantity, 0)) = 0 then null
        else round((sum(coalesce(s.sales_quantity, 0)) / sum(coalesce(s.delivery_quantity, 0))) * 100, 2)
    end::numeric as buyout_percent,
    sum(coalesce(s.tax_amount, 0))::numeric as tax_amount,
    sum(coalesce(s.cogs_amount, 0))::numeric as cogs_amount,
    (
        sum(coalesce(s.seller_transfer, 0))
        - sum(coalesce(s.delivery_cost, 0))
        - sum(coalesce(s.paid_storage_cost, 0))
        - sum(coalesce(s.penalty_cost, 0))
        - coalesce(acb.acceptance_cost, 0)
        - coalesce(ab.advert_cost, 0)
        - sum(coalesce(s.tax_amount, 0))
        - sum(coalesce(s.cogs_amount, 0))
    )::numeric as profit_amount,
    case
        when sum(coalesce(s.realization_before_spp, 0)) = 0 then null
        else round(((
            sum(coalesce(s.seller_transfer, 0))
            - sum(coalesce(s.delivery_cost, 0))
            - sum(coalesce(s.paid_storage_cost, 0))
            - sum(coalesce(s.penalty_cost, 0))
            - coalesce(acb.acceptance_cost, 0)
            - coalesce(ab.advert_cost, 0)
            - sum(coalesce(s.tax_amount, 0))
            - sum(coalesce(s.cogs_amount, 0))
        ) / sum(coalesce(s.realization_before_spp, 0))) * 100, 2)
    end::numeric as margin_percent,
    case
        when sum(coalesce(s.cogs_amount, 0)) = 0 then null
        else round(((
            sum(coalesce(s.seller_transfer, 0))
            - sum(coalesce(s.delivery_cost, 0))
            - sum(coalesce(s.paid_storage_cost, 0))
            - sum(coalesce(s.penalty_cost, 0))
            - coalesce(acb.acceptance_cost, 0)
            - coalesce(ab.advert_cost, 0)
            - sum(coalesce(s.tax_amount, 0))
            - sum(coalesce(s.cogs_amount, 0))
        ) / sum(coalesce(s.cogs_amount, 0))) * 100, 2)
    end::numeric as roi_percent
from mart.fact_unit_economics_day_size_current s
left join mart.fact_advert_day_item ab
  on ab.account_id = s.account_id
 and ab.calendar_date = s.calendar_date
 and ab.nm_id = s.nm_id
 and ab.vendor_code_norm = lower(btrim(s.vendor_code))
left join acceptance_base acb
  on acb.account_id = s.account_id
 and acb.calendar_date = s.calendar_date
 and acb.nm_id = s.nm_id
left join core.accounts acc
  on acc.account_id = s.account_id
left join core.product_card_photos pp
  on pp.account_id = s.account_id
 and pp.nm_id = s.nm_id
 and pp.photo_index = 1
group by
    s.account_id,
    s.calendar_date,
    s.week_start,
    s.nm_id,
    s.vendor_code,
    acc.name,
    pp.photo_url,
    ab.advert_cost,
    acb.acceptance_cost;


