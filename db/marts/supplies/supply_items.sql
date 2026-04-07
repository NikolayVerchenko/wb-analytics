create schema if not exists mart;

create or replace view mart.supply_items as
with primary_photos as (
    select
        p.account_id,
        p.nm_id,
        p.photo_url
    from core.product_card_photos p
    where p.photo_index = 1
)
select
    sgh.account_id,
    sgh.supply_id,
    sgh.preorder_id,
    sgh.supply_target_id,
    sgh.is_preorder_id,
    sgh.status_id,
    sgh.create_date,
    sgh.supply_date,
    sgh.fact_date,
    sgh.updated_date,
    sgh.nm_id,
    sgh.vendor_code,
    sgh.tech_size,
    sgh.barcode,
    sgh.color,
    sgh.need_kiz,
    sgh.tnved,
    sgh.supplier_box_amount,
    sgh.quantity,
    sgh.ready_for_sale_quantity,
    sgh.unloading_quantity,
    sgh.accepted_quantity,
    pp.photo_url
from core.supply_goods_with_header sgh
left join primary_photos pp
  on pp.account_id = sgh.account_id
 and pp.nm_id = sgh.nm_id
where sgh.supply_target_id is not null
  and sgh.nm_id is not null
  and sgh.vendor_code is not null
  and btrim(sgh.vendor_code) <> '';
