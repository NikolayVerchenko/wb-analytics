create schema if not exists mart;

create or replace view mart.sku_unit_economics_weekly as
with primary_photos as (
    select
        p.account_id,
        p.nm_id,
        p.photo_url
    from core.product_card_photos p
    where p.photo_index = 1
),
weekly_base as (
    select
        rw.account_id,
        rw.week_start,
        rw.nm_id,
        rw.sa_name as vendor_code,
        rw.ts_name,
        max(rw.brand_name) as brand_name,
        max(rw.subject_name) as subject_name,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity, 0)
                else 0
            end
        )::bigint as sales_quantity
        ,
        sum(
            case
                when rw.supplier_oper_name = 'Возврат' then coalesce(rw.quantity, 0)
                else 0
            end
        )::bigint as return_quantity,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_price, 0)
                else 0
            end
        )::numeric as retail_price_sale,
        sum(
            case
                when rw.supplier_oper_name = 'Возврат' then coalesce(rw.retail_price, 0)
                else 0
            end
        )::numeric as retail_price_return,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_price, 0)
                when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.retail_price, 0)
                else 0
            end
        )::numeric as realization_before_spp,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_amount, 0)
                else 0
            end
        )::numeric as retail_amount_sale,
        sum(
            case
                when rw.supplier_oper_name = 'Возврат' then coalesce(rw.retail_amount, 0)
                else 0
            end
        )::numeric as retail_amount_return,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_amount, 0)
                when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.retail_amount, 0)
                else 0
            end
        )::numeric as realization_after_spp,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.ppvz_for_pay, 0)
                else 0
            end
        )::numeric as ppvz_for_pay_sale,
        sum(
            case
                when rw.supplier_oper_name = 'Возврат' then coalesce(rw.ppvz_for_pay, 0)
                else 0
            end
        )::numeric as ppvz_for_pay_return,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.ppvz_for_pay, 0)
                when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.ppvz_for_pay, 0)
                else 0
            end
        )::numeric as seller_transfer
    from core.report_detail_weekly rw
    where rw.nm_id is not null
      and rw.nm_id <> 0
      and rw.sa_name is not null
      and btrim(rw.sa_name) <> ''
      and rw.week_start is not null
    group by
        rw.account_id,
        rw.week_start,
        rw.nm_id,
        rw.sa_name,
        rw.ts_name
)
select
    wb.account_id,
    wb.week_start,
    wb.nm_id,
    wb.vendor_code,
    wb.ts_name,
    wb.brand_name,
    wb.subject_name,
    acc.name as account_name,
    pp.photo_url,
    wb.sales_quantity,
    wb.return_quantity,
    wb.retail_price_sale,
    wb.retail_price_return,
    wb.realization_before_spp,
    wb.retail_amount_sale,
    wb.retail_amount_return,
    wb.realization_after_spp,
    (wb.realization_before_spp - wb.realization_after_spp)::numeric as spp_amount,
    case
        when wb.realization_before_spp = 0 then null
        else round(((wb.realization_before_spp - wb.realization_after_spp) / wb.realization_before_spp) * 100, 2)
    end::numeric as spp_percent,
    wb.ppvz_for_pay_sale,
    wb.ppvz_for_pay_return,
    wb.seller_transfer,
    (wb.realization_before_spp - wb.seller_transfer)::numeric as wb_commission_amount,
    case
        when wb.realization_before_spp = 0 then null
        else round(((wb.realization_before_spp - wb.seller_transfer) / wb.realization_before_spp) * 100, 2)
    end::numeric as wb_commission_percent
from weekly_base wb
left join core.accounts acc
  on acc.account_id = wb.account_id
left join primary_photos pp
  on pp.account_id = wb.account_id
 and pp.nm_id = wb.nm_id;
