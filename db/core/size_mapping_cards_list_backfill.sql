-- Safe backfill for cards_list size mapping.
-- Inserts only direct normalized name matches observed in report_detail_weekly.

with src as (
    select distinct
        account_id,
        nm_id,
        core.normalize_size(tech_size) as source_size_value
    from core.product_card_sizes
    where nm_id is not null
      and core.normalize_size(tech_size) <> ''
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
        src.account_id,
        src.nm_id,
        src.source_size_value,
        rw.canonical_ts_name
    from src
    join rw
      on rw.account_id = src.account_id
     and rw.nm_id = src.nm_id
     and rw.canonical_ts_name = src.source_size_value
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
    'cards_list' as source_system,
    source_size_value,
    canonical_ts_name,
    'mapped' as mapping_status,
    'normalized_name_match' as mapping_method
from clean
on conflict do nothing;
