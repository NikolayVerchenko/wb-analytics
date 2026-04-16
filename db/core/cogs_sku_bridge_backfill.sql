-- Safe initial backfill for COGS bridge.
-- Maps only supply-side variants whose tech_size exactly matches canonical ts_name
-- after core.normalize_size() normalization.

insert into core.cogs_sku_bridge (
    account_id,
    supply_id,
    nm_id,
    vendor_code,
    tech_size,
    barcode,
    canonical_ts_name,
    mapping_status,
    mapping_method
)
select distinct
    sic.account_id,
    sic.supply_id,
    sic.nm_id,
    sic.vendor_code,
    sic.tech_size,
    sic.barcode,
    rw.canonical_ts_name,
    'mapped' as mapping_status,
    'exact_size_name_match' as mapping_method
from core.account_supply_item_costs sic
join (
    select distinct
        account_id,
        gi_id as supply_id,
        nm_id,
        lower(btrim(sa_name)) as vendor_code_norm,
        core.normalize_size(ts_name) as canonical_ts_name
    from core.report_detail_weekly
    where gi_id is not null
      and nm_id is not null
      and nm_id <> 0
      and sa_name is not null
      and btrim(sa_name) <> ''
      and core.normalize_size(ts_name) <> ''

    union

    select distinct
        account_id,
        gi_id as supply_id,
        nm_id,
        lower(btrim(sa_name)) as vendor_code_norm,
        core.normalize_size(ts_name) as canonical_ts_name
    from core.report_detail_daily
    where gi_id is not null
      and nm_id is not null
      and nm_id <> 0
      and sa_name is not null
      and btrim(sa_name) <> ''
      and core.normalize_size(ts_name) <> ''
) rw
  on rw.account_id = sic.account_id
 and rw.supply_id = sic.supply_id
 and rw.nm_id = sic.nm_id
 and rw.vendor_code_norm = lower(btrim(sic.vendor_code))
 and rw.canonical_ts_name = core.normalize_size(sic.tech_size)
where core.normalize_size(sic.tech_size) <> ''
on conflict do nothing;
