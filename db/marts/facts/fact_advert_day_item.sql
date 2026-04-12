create schema if not exists mart;

create or replace view mart.fact_advert_day_item as
select
    aca.account_id,
    aca.upd_time::date as calendar_date,
    aca.nm_id,
    max(nullif(lower(btrim(aca.vendor_code)), '')) as vendor_code_norm,
    sum(coalesce(aca.allocated_upd_sum, 0))::numeric as advert_cost
from core.advert_cost_allocations aca
where aca.upd_time is not null
  and aca.nm_id is not null
group by
    aca.account_id,
    aca.upd_time::date,
    aca.nm_id;
