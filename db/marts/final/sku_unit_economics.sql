create schema if not exists mart;

drop view if exists mart.sku_unit_economics;

create or replace view mart.sku_unit_economics_daily_draft as
with funnel_base as (
    select
        pf.account_id,
        pf.period_from as calendar_date,
        pf.nm_id,
        pf.vendor_code,
        pf.brand_name,
        pf.subject_name,
        pf.order_count,
        pf.order_sum
    from core.product_funnel pf
),
primary_photos as (
    select
        p.account_id,
        p.nm_id,
        p.photo_url
    from core.product_card_photos p
    where p.photo_index = 1
),
report_sizes as (
    select distinct
        rd.account_id,
        rd.rr_dt as calendar_date,
        rd.nm_id,
        rd.sa_name as vendor_code,
        rd.ts_name
    from core.report_detail_daily rd
    where rd.nm_id is not null
      and rd.sa_name is not null

    union

    select distinct
        rw.account_id,
        rw.rr_dt as calendar_date,
        rw.nm_id,
        rw.sa_name as vendor_code,
        rw.ts_name
    from core.report_detail_weekly rw
    where rw.nm_id is not null
      and rw.sa_name is not null
),
report_sales as (
    select
        rd.account_id,
        rd.rr_dt as calendar_date,
        rd.nm_id,
        rd.sa_name as vendor_code,
        rd.ts_name,
        sum(coalesce(rd.quantity, 0)) as sales_quantity
    from core.report_detail_daily rd
    where rd.nm_id is not null
      and rd.sa_name is not null
      and rd.supplier_oper_name = 'Продажа'
    group by rd.account_id, rd.rr_dt, rd.nm_id, rd.sa_name, rd.ts_name

    union all

    select
        rw.account_id,
        rw.rr_dt as calendar_date,
        rw.nm_id,
        rw.sa_name as vendor_code,
        rw.ts_name,
        sum(coalesce(rw.quantity, 0)) as sales_quantity
    from core.report_detail_weekly rw
    where rw.nm_id is not null
      and rw.sa_name is not null
      and rw.supplier_oper_name = 'Продажа'
    group by rw.account_id, rw.rr_dt, rw.nm_id, rw.sa_name, rw.ts_name
),
report_sales_total as (
    select
        rs.account_id,
        rs.calendar_date,
        rs.nm_id,
        rs.vendor_code,
        sum(rs.sales_quantity)::bigint as sales_quantity
    from report_sales rs
    group by rs.account_id, rs.calendar_date, rs.nm_id, rs.vendor_code
),
base_with_sizes as (
    select
        fb.account_id,
        fb.calendar_date,
        fb.nm_id,
        fb.vendor_code,
        rs.ts_name,
        fb.brand_name,
        fb.subject_name,
        fb.order_count,
        fb.order_sum
    from funnel_base fb
    left join report_sizes rs
      on rs.account_id = fb.account_id
     and rs.calendar_date = fb.calendar_date
     and rs.nm_id = fb.nm_id
     and rs.vendor_code = fb.vendor_code
)
select
    bws.account_id,
    bws.calendar_date,
    bws.nm_id,
    bws.vendor_code,
    bws.ts_name,
    bws.brand_name,
    bws.subject_name,
    acc.name as account_name,
    pp.photo_url,
    bws.order_count,
    bws.order_sum,
    coalesce(rs.sales_quantity, rst.sales_quantity) as sales_quantity
from base_with_sizes bws
left join core.accounts acc
  on acc.account_id = bws.account_id
left join primary_photos pp
  on pp.account_id = bws.account_id
 and pp.nm_id = bws.nm_id
left join report_sales rs
  on rs.account_id = bws.account_id
 and rs.calendar_date = bws.calendar_date
 and rs.nm_id = bws.nm_id
 and rs.vendor_code = bws.vendor_code
 and rs.ts_name is not distinct from bws.ts_name
left join report_sales_total rst
  on rst.account_id = bws.account_id
 and rst.calendar_date = bws.calendar_date
 and rst.nm_id = bws.nm_id
 and rst.vendor_code = bws.vendor_code;
