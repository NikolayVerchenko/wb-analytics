-- Safe backfill for paid_storage size mapping.
-- Inserts only direct normalized name matches observed in report_detail_weekly.

with ps as (
    select distinct
        account_id,
        nm_id,
        core.normalize_size(size) as source_size_value
    from core.paid_storage_costs
    where nm_id is not null
      and core.normalize_size(size) <> ''
),
rw as (
    select distinct
        account_id,
        nm_id,
        core.normalize_size(ts_name) as canonical_ts_name
    from core.report_detail_weekly
    where nm_id is not null
      and core.normalize_size(ts_name) <> ''
),
clean as (
    select distinct
        ps.account_id,
        ps.nm_id,
        ps.source_size_value,
        rw.canonical_ts_name
    from ps
    join rw
      on rw.account_id = ps.account_id
     and rw.nm_id = ps.nm_id
     and rw.canonical_ts_name = ps.source_size_value
)
insert into core.size_mapping (
    account_id,
    nm_id,
    source_system,
    source_size_value,
    canonical_ts_name,
    mapping_status,
    mapping_method
)
select
    account_id,
    nm_id,
    'paid_storage' as source_system,
    source_size_value,
    canonical_ts_name,
    'mapped' as mapping_status,
    'normalized_name_match' as mapping_method
from clean
on conflict do nothing;
