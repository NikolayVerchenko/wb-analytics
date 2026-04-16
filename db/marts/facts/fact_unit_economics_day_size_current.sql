create schema if not exists mart;

create or replace view mart.fact_unit_economics_day_size_current as
with paid_storage_base as (
    select
        psc.account_id,
        psc.report_date as calendar_date,
        psc.nm_id,
        lower(btrim(psc.vendor_code)) as vendor_code_norm,
        core.normalize_size(psc.size) as size_norm,
        sum(coalesce(psc.warehouse_price, 0))::numeric as paid_storage_cost,
        max(psc.subject) as subject_name,
        max(psc.brand) as brand_name
    from core.paid_storage_costs psc
    group by
        psc.account_id,
        psc.report_date,
        psc.nm_id,
        lower(btrim(psc.vendor_code)),
        core.normalize_size(psc.size)
),
cogs_base as (
    select
        rw.account_id,
        rw.rr_dt as calendar_date,
        rw.week_start,
        rw.nm_id,
        rw.sa_name as vendor_code,
        rw.ts_name,
        sum(
            case
                when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity, 0) * coalesce(sic.unit_cogs, 0)
                when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity, 0) * coalesce(sic.unit_cogs, 0)
                else 0
            end
        )::numeric as cogs_amount
    from core.report_detail_daily rw
    left join (
        select
            sic.account_id,
            sic.supply_id,
            sic.nm_id,
            lower(btrim(sic.vendor_code)) as vendor_code_norm,
            coalesce(
                csb.canonical_ts_name,
                core.normalize_size(sic.tech_size)
            ) as canonical_ts_name_norm,
            sic.unit_cogs
        from core.account_supply_item_costs sic
        left join core.cogs_sku_bridge csb
          on csb.account_id = sic.account_id
         and csb.supply_id = sic.supply_id
         and csb.nm_id = sic.nm_id
         and lower(btrim(csb.vendor_code)) = lower(btrim(sic.vendor_code))
         and coalesce(csb.tech_size, '') = coalesce(sic.tech_size, '')
         and coalesce(csb.barcode, '') = coalesce(sic.barcode, '')
    ) sic
      on sic.account_id = rw.account_id
     and sic.supply_id = rw.gi_id
     and sic.nm_id = rw.nm_id
     and sic.vendor_code_norm = lower(btrim(rw.sa_name))
     and sic.canonical_ts_name_norm = core.normalize_size(rw.ts_name)
    where rw.gi_id is not null
      and rw.nm_id is not null
      and rw.nm_id <> 0
      and rw.sa_name is not null
      and btrim(rw.sa_name) <> ''
      and rw.rr_dt is not null
    group by
        rw.account_id,
        rw.rr_dt,
        rw.week_start,
        rw.nm_id,
        rw.sa_name,
        rw.ts_name
),
tax_settings as (
    select
        ats.account_id,
        ats.tax_rate
    from core.account_tax_settings ats
),
daily_base as (
    select
        rw.account_id,
        rw.rr_dt as calendar_date,
        rw.week_start,
        rw.nm_id,
        rw.sa_name as vendor_code,
        rw.ts_name,
        max(rw.brand_name) as brand_name,
        max(rw.subject_name) as subject_name,
        string_agg(distinct case when rw.supplier_oper_name in ('Штраф', 'Удержание') then nullif(btrim(rw.bonus_type_name), '') end, '; ') as bonus_type_name,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity, 0) else 0 end)::bigint as sales_quantity,
        sum(case when rw.supplier_oper_name = 'Возврат' then coalesce(rw.quantity, 0) else 0 end)::bigint as return_quantity,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_price, 0) else 0 end)::numeric as retail_price_sale,
        sum(case when rw.supplier_oper_name = 'Возврат' then coalesce(rw.retail_price, 0) else 0 end)::numeric as retail_price_return,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_price, 0)
                 when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.retail_price, 0)
                 else 0 end)::numeric as realization_before_spp,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_amount, 0) else 0 end)::numeric as retail_amount_sale,
        sum(case when rw.supplier_oper_name = 'Возврат' then coalesce(rw.retail_amount, 0) else 0 end)::numeric as retail_amount_return,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.retail_amount, 0)
                 when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.retail_amount, 0)
                 else 0 end)::numeric as realization_after_spp,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.ppvz_for_pay, 0) else 0 end)::numeric as ppvz_for_pay_sale,
        sum(case when rw.supplier_oper_name = 'Возврат' then coalesce(rw.ppvz_for_pay, 0) else 0 end)::numeric as ppvz_for_pay_return,
        sum(case when rw.supplier_oper_name = 'Продажа' then coalesce(rw.ppvz_for_pay, 0)
                 when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.ppvz_for_pay, 0)
                 else 0 end)::numeric as seller_transfer,
        sum(case when rw.supplier_oper_name = 'Логистика' then coalesce(rw.delivery_amount, 0) else 0 end)::numeric as delivery_quantity,
        sum(case when rw.supplier_oper_name = 'Логистика' then coalesce(rw.return_amount, 0) else 0 end)::numeric as refusal_quantity,
        sum(case when rw.supplier_oper_name = 'Логистика' then coalesce(rw.delivery_rub, 0) else 0 end)::numeric as delivery_cost_base,
        sum(case when rw.supplier_oper_name = 'Коррекция логистики' then coalesce(rw.delivery_rub, 0) else 0 end)::numeric as delivery_cost_correction,
        sum(case when rw.supplier_oper_name = 'Штраф' then coalesce(rw.penalty, 0) else 0 end)::numeric as penalty_cost,
        sum(coalesce(rw.cashback_amount, 0))::numeric as cashback_amount
    from core.report_detail_daily rw
    where rw.nm_id is not null
      and rw.nm_id <> 0
      and rw.sa_name is not null
      and btrim(rw.sa_name) <> ''
      and rw.rr_dt is not null
    group by
        rw.account_id,
        rw.rr_dt,
        rw.week_start,
        rw.nm_id,
        rw.sa_name,
        rw.ts_name
),
base_keys as (
    select
        db.account_id,
        db.calendar_date,
        db.week_start,
        db.nm_id,
        lower(btrim(db.vendor_code)) as vendor_code,
        core.normalize_size(db.ts_name) as ts_name
    from daily_base db
    union
    select
        psb.account_id,
        psb.calendar_date,
        date_trunc('week', psb.calendar_date::timestamp)::date as week_start,
        psb.nm_id,
        psb.vendor_code_norm as vendor_code,
        psb.size_norm as ts_name
    from paid_storage_base psb
)
select
    bk.account_id,
    bk.calendar_date,
    bk.week_start,
    bk.nm_id,
    coalesce(db.vendor_code, bk.vendor_code) as vendor_code,
    coalesce(db.ts_name, bk.ts_name) as ts_name,
    coalesce(db.brand_name, psb.brand_name) as brand_name,
    coalesce(db.subject_name, psb.subject_name) as subject_name,
    db.bonus_type_name,
    db.sales_quantity,
    db.return_quantity,
    db.retail_price_sale,
    db.retail_price_return,
    db.realization_before_spp,
    db.retail_amount_sale,
    db.retail_amount_return,
    db.realization_after_spp,
    (db.realization_before_spp - db.realization_after_spp)::numeric as spp_amount,
    case
        when db.realization_before_spp = 0 then null
        else round(((db.realization_before_spp - db.realization_after_spp) / db.realization_before_spp) * 100, 2)
    end::numeric as spp_percent,
    db.ppvz_for_pay_sale,
    db.ppvz_for_pay_return,
    db.seller_transfer,
    db.delivery_quantity,
    db.refusal_quantity,
    (coalesce(db.delivery_cost_base, 0) + coalesce(db.delivery_cost_correction, 0))::numeric as delivery_cost,
    db.penalty_cost,
    db.cashback_amount,
    coalesce(psb.paid_storage_cost, 0)::numeric as paid_storage_cost,
    (db.realization_before_spp - db.seller_transfer)::numeric as wb_commission_amount,
    case
        when db.realization_before_spp = 0 then null
        else round(((db.realization_before_spp - db.seller_transfer) / db.realization_before_spp) * 100, 2)
    end::numeric as wb_commission_percent,
    case
        when db.delivery_quantity = 0 then null
        else round((db.sales_quantity / db.delivery_quantity) * 100, 2)
    end::numeric as buyout_percent,
    case
        when ts.tax_rate is null then null
        else round(db.realization_after_spp * ts.tax_rate, 2)
    end::numeric as tax_amount,
    coalesce(cb.cogs_amount, 0)::numeric as cogs_amount,
    (
        db.seller_transfer
        - (coalesce(db.delivery_cost_base, 0) + coalesce(db.delivery_cost_correction, 0))
        - coalesce(psb.paid_storage_cost, 0)
        - db.penalty_cost
        - coalesce(
            case
                when ts.tax_rate is null then null
                else round(db.realization_after_spp * ts.tax_rate, 2)
            end,
            0
        )
        - coalesce(cb.cogs_amount, 0)
    )::numeric as profit_amount,
    case
        when db.realization_before_spp = 0 then null
        else round((
            (
                db.seller_transfer
                - (coalesce(db.delivery_cost_base, 0) + coalesce(db.delivery_cost_correction, 0))
                - coalesce(psb.paid_storage_cost, 0)
                - db.penalty_cost
                - coalesce(
                    case
                        when ts.tax_rate is null then null
                        else round(db.realization_after_spp * ts.tax_rate, 2)
                    end,
                    0
                )
                - coalesce(cb.cogs_amount, 0)
            ) / db.realization_before_spp
        ) * 100, 2)
    end::numeric as margin_percent,
    case
        when coalesce(cb.cogs_amount, 0) = 0 then null
        else round((
            (
                db.seller_transfer
                - (coalesce(db.delivery_cost_base, 0) + coalesce(db.delivery_cost_correction, 0))
                - coalesce(psb.paid_storage_cost, 0)
                - db.penalty_cost
                - coalesce(
                    case
                        when ts.tax_rate is null then null
                        else round(db.realization_after_spp * ts.tax_rate, 2)
                    end,
                    0
                )
                - coalesce(cb.cogs_amount, 0)
            ) / coalesce(cb.cogs_amount, 0)
        ) * 100, 2)
    end::numeric as roi_percent
    ,
    db.delivery_cost_base,
    db.delivery_cost_correction
from base_keys bk
left join daily_base db
  on db.account_id = bk.account_id
 and db.calendar_date = bk.calendar_date
 and db.week_start = bk.week_start
 and db.nm_id = bk.nm_id
 and lower(btrim(db.vendor_code)) = lower(btrim(bk.vendor_code))
 and core.normalize_size(db.ts_name) = bk.ts_name
left join cogs_base cb
  on cb.account_id = bk.account_id
 and cb.calendar_date = bk.calendar_date
 and cb.week_start = bk.week_start
 and cb.nm_id = bk.nm_id
 and lower(btrim(cb.vendor_code)) = lower(btrim(bk.vendor_code))
 and core.normalize_size(cb.ts_name) = bk.ts_name
left join tax_settings ts
  on ts.account_id = bk.account_id
left join paid_storage_base psb
  on psb.account_id = bk.account_id
 and psb.calendar_date = bk.calendar_date
 and psb.nm_id = bk.nm_id
 and psb.vendor_code_norm = lower(btrim(bk.vendor_code))
 and psb.size_norm = bk.ts_name;
