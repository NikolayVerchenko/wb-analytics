create schema if not exists core;

create or replace view core.advert_nms_with_vendor_code as
select
    an.account_id,
    an.advert_id,
    an.nm_id,
    an.subject_id,
    an.subject_name,
    an.bid_search_kopecks,
    an.bid_recommendations_kopecks,
    lower(btrim(coalesce(pc.vendor_code, ''))) as vendor_code
from core.advert_nms an
left join core.product_cards pc
  on pc.account_id = an.account_id
 and pc.nm_id = an.nm_id;

create or replace view core.advert_cost_allocations as
with advert_nm_counts as (
    select
        account_id,
        advert_id,
        count(*)::numeric as nm_count
    from core.advert_nms_with_vendor_code
    group by account_id, advert_id
)
select
    ac.account_id,
    ac.advert_id,
    ac.upd_num,
    ac.upd_time,
    ac.upd_sum,
    anv.nm_id,
    anv.vendor_code,
    case
        when anc.nm_count is null or anc.nm_count = 0 then null
        else ac.upd_sum / anc.nm_count
    end::numeric as allocated_upd_sum
from core.advert_costs ac
left join advert_nm_counts anc
  on anc.account_id = ac.account_id
 and anc.advert_id = ac.advert_id
left join core.advert_nms_with_vendor_code anv
  on anv.account_id = ac.account_id
 and anv.advert_id = ac.advert_id;

create or replace view core.advert_costs_by_vendor_code as
select
    account_id,
    upd_time::date as calendar_date,
    vendor_code,
    sum(coalesce(allocated_upd_sum, 0))::numeric as advert_cost
from core.advert_cost_allocations
where upd_time is not null
  and vendor_code is not null
  and btrim(vendor_code) <> ''
group by account_id, upd_time::date, vendor_code;

create or replace view core.supply_goods_with_header as
select
    sg.account_id,
    s.supply_id,
    s.preorder_id,
    sg.supply_target_id,
    sg.is_preorder_id,
    s.status_id,
    s.create_date,
    s.supply_date,
    s.fact_date,
    s.updated_date,
    sg.nm_id,
    sg.vendor_code,
    sg.tech_size,
    sg.barcode,
    sg.color,
    sg.need_kiz,
    sg.tnved,
    sg.supplier_box_amount,
    sg.quantity,
    sg.ready_for_sale_quantity,
    sg.unloading_quantity,
    sg.accepted_quantity
from core.supply_goods sg
left join core.supplies s
  on s.account_id = sg.account_id
 and (
    (sg.is_preorder_id = true and s.preorder_id = sg.supply_target_id)
    or (sg.is_preorder_id = false and s.supply_id = sg.supply_target_id)
 );
