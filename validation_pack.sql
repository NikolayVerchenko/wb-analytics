-- === PARAMS ===
-- :account_id
-- :date_from
-- :date_to

-- =========================================================
-- 1) core.sku coverage vs report_detail_weekly
-- =========================================================
with weekly_set as (
  select distinct
    account_id,
    nm_id,
    core.normalize_size(ts_name) as ts_name_norm
  from core.report_detail_weekly
  where account_id = :account_id
    and nm_id is not null
    and core.normalize_size(ts_name) <> ''
),
sku_set as (
  select distinct
    account_id,
    nm_id,
    core.normalize_size(ts_name) as ts_name_norm
  from core.sku
  where account_id = :account_id
    and nm_id is not null
    and core.normalize_size(ts_name) <> ''
)
select
  'core.sku coverage' as check_name,
  (select count(*) from core.sku where account_id = :account_id) as sku_rows,
  (select count(*) from sku_set) as sku_distinct,
  (select count(*) from weekly_set) as report_distinct,
  round(
    100.0 * (select count(*) from sku_set)
    / nullif((select count(*) from weekly_set), 0),
    2
  ) as coverage_pct;

-- 1.1) core.sku unmatched (in sku, not in report_detail_weekly)
with weekly_set as (
  select distinct
    account_id,
    nm_id,
    core.normalize_size(ts_name) as ts_name_norm
  from core.report_detail_weekly
  where account_id = :account_id
    and nm_id is not null
    and core.normalize_size(ts_name) <> ''
),
sku_set as (
  select distinct
    account_id,
    nm_id,
    core.normalize_size(ts_name) as ts_name_norm
  from core.sku
  where account_id = :account_id
    and nm_id is not null
    and core.normalize_size(ts_name) <> ''
)
select
  'core.sku unmatched' as check_name,
  count(*) as unmatched_sku
from sku_set s
left join weekly_set r
  on r.account_id = s.account_id
 and r.nm_id = s.nm_id
 and r.ts_name_norm = s.ts_name_norm
where r.nm_id is null;

-- =========================================================
-- 2) size_mapping coverage per analytics source
--    supply_goods is excluded here because it is used only for COGS allocation
-- =========================================================

-- 2.1) cardsList observed coverage
with src as (
  select distinct
    pcs.account_id,
    pcs.nm_id,
    core.normalize_size(pcs.tech_size) as src_size
  from core.product_card_sizes pcs
  join (
    select distinct
      account_id,
      nm_id,
      core.normalize_size(ts_name) as ts_name_norm
    from core.report_detail_weekly
    where account_id = :account_id
      and nm_id is not null
      and core.normalize_size(ts_name) <> ''
  ) rw
    on rw.account_id = pcs.account_id
   and rw.nm_id = pcs.nm_id
   and rw.ts_name_norm = core.normalize_size(pcs.tech_size)
  where pcs.account_id = :account_id
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'cards_list'
)
select
  'size_mapping cardsList observed coverage' as check_name,
  (select count(*) from src) as src_count,
  (select count(*) from mapped) as mapped_count,
  round(100.0 * (select count(*) from mapped) / nullif((select count(*) from src), 0), 2) as coverage_pct;

-- 2.2) warehouseRemains coverage
with src as (
  select distinct account_id, nm_id, core.normalize_size(tech_size) as src_size
  from core.warehouse_remains_items
  where account_id = :account_id
    and core.normalize_size(tech_size) <> '0'
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'warehouse_remains'
    and core.normalize_size(source_size_value) <> '0'
)
select
  'size_mapping warehouseRemains coverage' as check_name,
  (select count(*) from src) as src_count,
  (select count(*) from mapped) as mapped_count,
  round(100.0 * (select count(*) from mapped) / nullif((select count(*) from src), 0), 2) as coverage_pct;

-- 2.3) paid_storage coverage
with src as (
  select distinct account_id, nm_id, core.normalize_size(size) as src_size
  from core.paid_storage_costs
  where account_id = :account_id
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'paid_storage'
)
select
  'size_mapping paid_storage coverage' as check_name,
  (select count(*) from src) as src_count,
  (select count(*) from mapped) as mapped_count,
  round(100.0 * (select count(*) from mapped) / nullif((select count(*) from src), 0), 2) as coverage_pct;

-- =========================================================
-- 3) size_mapping unmatched per analytics source
-- =========================================================

-- 3.1) cardsList observed unmatched
with src as (
  select distinct
    pcs.account_id,
    pcs.nm_id,
    core.normalize_size(pcs.tech_size) as src_size
  from core.product_card_sizes pcs
  join (
    select distinct
      account_id,
      nm_id,
      core.normalize_size(ts_name) as ts_name_norm
    from core.report_detail_weekly
    where account_id = :account_id
      and nm_id is not null
      and core.normalize_size(ts_name) <> ''
  ) rw
    on rw.account_id = pcs.account_id
   and rw.nm_id = pcs.nm_id
   and rw.ts_name_norm = core.normalize_size(pcs.tech_size)
  where pcs.account_id = :account_id
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'cards_list'
)
select
  'size_mapping cardsList observed unmatched' as check_name,
  count(*) as unmatched_count
from src s
left join mapped m
  on m.account_id = s.account_id
 and m.nm_id = s.nm_id
 and m.src_size = s.src_size
where m.nm_id is null;

-- 3.2) warehouseRemains unmatched
with src as (
  select distinct account_id, nm_id, core.normalize_size(tech_size) as src_size
  from core.warehouse_remains_items
  where account_id = :account_id
    and core.normalize_size(tech_size) <> '0'
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'warehouse_remains'
    and core.normalize_size(source_size_value) <> '0'
)
select
  'size_mapping warehouseRemains unmatched' as check_name,
  count(*) as unmatched_count
from src s
left join mapped m
  on m.account_id = s.account_id
 and m.nm_id = s.nm_id
 and m.src_size = s.src_size
where m.nm_id is null;

-- 3.3) paid_storage unmatched
with src as (
  select distinct account_id, nm_id, core.normalize_size(size) as src_size
  from core.paid_storage_costs
  where account_id = :account_id
),
mapped as (
  select distinct account_id, nm_id, core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and source_system = 'paid_storage'
)
select
  'size_mapping paid_storage unmatched' as check_name,
  count(*) as unmatched_count
from src s
left join mapped m
  on m.account_id = s.account_id
 and m.nm_id = s.nm_id
 and m.src_size = s.src_size
where m.nm_id is null;

-- =========================================================
-- 4) size_mapping ambiguous (one source_size -> multiple canonical_ts_name)
-- =========================================================
select
  'size_mapping ambiguous' as check_name,
  account_id,
  nm_id,
  source_system,
  source_size_value,
  count(distinct canonical_ts_name) as canonical_count
from core.size_mapping
where account_id = :account_id
group by account_id, nm_id, source_system, source_size_value
having count(distinct canonical_ts_name) > 1
order by canonical_count desc;

-- 4.1) size_mapping ambiguous counts per source_system
select
  'size_mapping ambiguous summary' as check_name,
  source_system,
  count(*) as ambiguous_pairs
from (
  select
    account_id,
    nm_id,
    source_system,
    source_size_value,
    count(distinct canonical_ts_name) as canonical_count
  from core.size_mapping
  where account_id = :account_id
  group by account_id, nm_id, source_system, source_size_value
  having count(distinct canonical_ts_name) > 1
) t
group by source_system
order by ambiguous_pairs desc;

-- 4.2) size_mapping unmatched percent per analytics source_system
with src as (
  select distinct
    'cards_list'::text as source_system,
    pcs.account_id,
    pcs.nm_id,
    core.normalize_size(pcs.tech_size) as src_size
  from core.product_card_sizes pcs
  join (
    select distinct
      account_id,
      nm_id,
      core.normalize_size(ts_name) as ts_name_norm
    from core.report_detail_weekly
    where account_id = :account_id
      and nm_id is not null
      and core.normalize_size(ts_name) <> ''
  ) rw
    on rw.account_id = pcs.account_id
   and rw.nm_id = pcs.nm_id
   and rw.ts_name_norm = core.normalize_size(pcs.tech_size)
  where pcs.account_id = :account_id
  union all
  select distinct 'warehouse_remains'::text as source_system, account_id, nm_id, core.normalize_size(tech_size) as src_size
  from core.warehouse_remains_items
  where account_id = :account_id
    and core.normalize_size(tech_size) <> '0'
  union all
  select distinct 'paid_storage'::text as source_system, account_id, nm_id, core.normalize_size(size) as src_size
  from core.paid_storage_costs
  where account_id = :account_id
),
mapped as (
  select
    source_system,
    account_id,
    nm_id,
    core.normalize_size(source_size_value) as src_size
  from core.size_mapping
  where account_id = :account_id
    and not (source_system = 'warehouse_remains' and core.normalize_size(source_size_value) = '0')
)
select
  'size_mapping unmatched pct' as check_name,
  s.source_system,
  count(*) as src_count,
  count(*) filter (where m.nm_id is null) as unmatched_count,
  round(100.0 * count(*) filter (where m.nm_id is null) / nullif(count(*), 0), 2) as unmatched_pct
from src s
left join mapped m
  on m.source_system = s.source_system
 and m.account_id = s.account_id
 and m.nm_id = s.nm_id
 and m.src_size = s.src_size
group by s.source_system
order by unmatched_pct desc;

-- =========================================================
-- 9) COGS bridge coverage
-- =========================================================
-- supply_goods is validated only in the COGS allocation contour

-- 9.1) allocatable sales-window cost rows coverage
with sales_keys as (
  select distinct
    rw.account_id,
    rw.gi_id as supply_id,
    rw.nm_id,
    core.normalize_size(rw.sa_name) as vendor_code_norm,
    core.normalize_size(rw.ts_name) as ts_name_norm
  from core.report_detail_weekly rw
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
    and rw.gi_id is not null
    and rw.nm_id is not null
    and rw.nm_id <> 0
    and rw.sa_name is not null
    and btrim(rw.sa_name) <> ''
    and core.normalize_size(rw.ts_name) <> ''
),
cost_rows as (
  select distinct
    sic.account_id,
    sic.supply_id,
    sic.nm_id,
    core.normalize_size(sic.vendor_code) as vendor_code_norm,
    core.normalize_size(sic.tech_size) as tech_size_norm,
    coalesce(sic.tech_size, '') as tech_size,
    coalesce(sic.barcode, '') as barcode
  from core.account_supply_item_costs sic
  where sic.account_id = :account_id
),
bridged as (
  select distinct
    csb.account_id,
    csb.supply_id,
    csb.nm_id,
    core.normalize_size(csb.vendor_code) as vendor_code_norm,
    coalesce(csb.tech_size, '') as tech_size,
    coalesce(csb.barcode, '') as barcode
  from core.cogs_sku_bridge csb
  where csb.account_id = :account_id
),
allocatable as (
  select distinct
    c.account_id,
    c.supply_id,
    c.nm_id,
    c.vendor_code_norm,
    c.tech_size,
    c.barcode
  from cost_rows c
  join sales_keys sk
    on sk.account_id = c.account_id
   and sk.supply_id = c.supply_id
   and sk.nm_id = c.nm_id
   and sk.vendor_code_norm = c.vendor_code_norm
   and sk.ts_name_norm = c.tech_size_norm
)
select
  'cogs allocatable coverage' as check_name,
  count(*) as allocatable_rows_count,
  count(*) filter (where b.nm_id is not null) as bridged_count,
  count(*) filter (where b.nm_id is null) as fallback_only_count,
  round(
    100.0 * count(*) filter (where b.nm_id is not null) / nullif(count(*), 0),
    2
  ) as coverage_pct
from allocatable c
left join bridged b
  on b.account_id = c.account_id
 and b.supply_id = c.supply_id
 and b.nm_id = c.nm_id
 and b.vendor_code_norm = c.vendor_code_norm
 and b.tech_size = c.tech_size
 and b.barcode = c.barcode;

-- 9.2) sales-window cost rows that do not map to any sold size
with sales_keys as (
  select distinct
    rw.account_id,
    rw.gi_id as supply_id,
    rw.nm_id,
    core.normalize_size(rw.sa_name) as vendor_code_norm,
    core.normalize_size(rw.ts_name) as ts_name_norm
  from core.report_detail_weekly rw
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
    and rw.gi_id is not null
    and rw.nm_id is not null
    and rw.nm_id <> 0
    and rw.sa_name is not null
    and btrim(rw.sa_name) <> ''
),
cost_rows as (
  select distinct
    sic.account_id,
    sic.supply_id,
    sic.nm_id,
    core.normalize_size(sic.vendor_code) as vendor_code_norm,
    core.normalize_size(sic.tech_size) as tech_size_norm,
    coalesce(sic.tech_size, '') as tech_size,
    coalesce(sic.barcode, '') as barcode
  from core.account_supply_item_costs sic
  where sic.account_id = :account_id
)
select
  'cogs non_allocatable in sales window' as check_name,
  count(*) as non_allocatable_count
from cost_rows c
join (
  select distinct
    account_id,
    supply_id,
    nm_id,
    vendor_code_norm
  from sales_keys
) sk
  on sk.account_id = c.account_id
 and sk.supply_id = c.supply_id
 and sk.nm_id = c.nm_id
 and sk.vendor_code_norm = c.vendor_code_norm
where not exists (
  select 1
  from sales_keys z
  where z.account_id = c.account_id
    and z.supply_id = c.supply_id
    and z.nm_id = c.nm_id
    and z.vendor_code_norm = c.vendor_code_norm
    and z.ts_name_norm = c.tech_size_norm
);

-- =========================================================
-- 5) Economics serving totals vs canonical SKU count (sanity)
-- =========================================================
select
  'ui_item_size_day totals' as check_name,
  count(*) as rows_count,
  count(distinct (account_id, nm_id, ts_name)) as sku_size_count
from mart.ui_item_size_day
where account_id = :account_id
  and calendar_date between :date_from and :date_to;

-- ========================================
-- 10) COGS OLD VS NEW
-- ========================================
-- OLD: sic.tech_size ↔ rw.ts_name (string match)
-- NEW: cogs_sku_bridge.canonical_ts_name with fallback to normalized sic.tech_size
-- DIFF: mismatches indicate bridge gaps or bad legacy source-to-size mapping

-- 10.1) TOTAL
with old_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_old
  from core.report_detail_weekly rw
  left join core.account_supply_item_costs sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and core.normalize_size(sic.tech_size) = core.normalize_size(rw.ts_name)
   and core.normalize_size(sic.vendor_code) = core.normalize_size(rw.sa_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
),
new_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_new
  from core.report_detail_weekly rw
  left join (
    select
      sic.account_id,
      sic.supply_id,
      sic.nm_id,
      core.normalize_size(sic.vendor_code) as vendor_code_norm,
      coalesce(
        core.normalize_size(csb.canonical_ts_name),
        core.normalize_size(sic.tech_size)
      ) as canonical_ts_name_norm,
      sic.unit_cogs
    from core.account_supply_item_costs sic
    left join core.cogs_sku_bridge csb
      on csb.account_id = sic.account_id
     and csb.supply_id = sic.supply_id
     and csb.nm_id = sic.nm_id
     and core.normalize_size(csb.vendor_code) = core.normalize_size(sic.vendor_code)
     and coalesce(csb.tech_size,'') = coalesce(sic.tech_size,'')
     and coalesce(csb.barcode,'') = coalesce(sic.barcode,'')
  ) sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and sic.vendor_code_norm = core.normalize_size(rw.sa_name)
   and sic.canonical_ts_name_norm = core.normalize_size(rw.ts_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
)
select
  'cogs total old vs new' as check_name,
  coalesce(sum(o.cogs_old), 0) as cogs_old,
  coalesce(sum(n.cogs_new), 0) as cogs_new,
  coalesce(sum(n.cogs_new), 0) - coalesce(sum(o.cogs_old), 0) as diff
from old_cogs o
full join new_cogs n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.ts_name;

-- 10.2) SKU LEVEL
with old_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_old
  from core.report_detail_weekly rw
  left join core.account_supply_item_costs sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and core.normalize_size(sic.tech_size) = core.normalize_size(rw.ts_name)
   and core.normalize_size(sic.vendor_code) = core.normalize_size(rw.sa_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
),
new_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_new
  from core.report_detail_weekly rw
  left join (
    select
      sic.account_id,
      sic.supply_id,
      sic.nm_id,
      core.normalize_size(sic.vendor_code) as vendor_code_norm,
      coalesce(
        core.normalize_size(csb.canonical_ts_name),
        core.normalize_size(sic.tech_size)
      ) as canonical_ts_name_norm,
      sic.unit_cogs
    from core.account_supply_item_costs sic
    left join core.cogs_sku_bridge csb
      on csb.account_id = sic.account_id
     and csb.supply_id = sic.supply_id
     and csb.nm_id = sic.nm_id
     and core.normalize_size(csb.vendor_code) = core.normalize_size(sic.vendor_code)
     and coalesce(csb.tech_size,'') = coalesce(sic.tech_size,'')
     and coalesce(csb.barcode,'') = coalesce(sic.barcode,'')
  ) sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and sic.vendor_code_norm = core.normalize_size(rw.sa_name)
   and sic.canonical_ts_name_norm = core.normalize_size(rw.ts_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
)
select
  'cogs sku level' as check_name,
  coalesce(o.account_id, n.account_id) as account_id,
  coalesce(o.calendar_date, n.calendar_date) as calendar_date,
  coalesce(o.nm_id, n.nm_id) as nm_id,
  coalesce(o.ts_name, n.ts_name) as ts_name,
  coalesce(o.cogs_old, 0) as cogs_old,
  coalesce(n.cogs_new, 0) as cogs_new,
  coalesce(n.cogs_new, 0) - coalesce(o.cogs_old, 0) as diff
from old_cogs o
full join new_cogs n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.ts_name;

-- 10.3) TOP DIFF
with old_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_old
  from core.report_detail_weekly rw
  left join core.account_supply_item_costs sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and core.normalize_size(sic.tech_size) = core.normalize_size(rw.ts_name)
   and core.normalize_size(sic.vendor_code) = core.normalize_size(rw.sa_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
),
new_cogs as (
  select
    rw.account_id,
    rw.rr_dt as calendar_date,
    rw.nm_id,
    core.normalize_size(rw.ts_name) as ts_name,
    sum(
      case
        when rw.supplier_oper_name = 'Продажа' then coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        when rw.supplier_oper_name = 'Возврат' then -coalesce(rw.quantity,0) * coalesce(sic.unit_cogs,0)
        else 0
      end
    )::numeric as cogs_new
  from core.report_detail_weekly rw
  left join (
    select
      sic.account_id,
      sic.supply_id,
      sic.nm_id,
      core.normalize_size(sic.vendor_code) as vendor_code_norm,
      coalesce(
        core.normalize_size(csb.canonical_ts_name),
        core.normalize_size(sic.tech_size)
      ) as canonical_ts_name_norm,
      sic.unit_cogs
    from core.account_supply_item_costs sic
    left join core.cogs_sku_bridge csb
      on csb.account_id = sic.account_id
     and csb.supply_id = sic.supply_id
     and csb.nm_id = sic.nm_id
     and core.normalize_size(csb.vendor_code) = core.normalize_size(sic.vendor_code)
     and coalesce(csb.tech_size,'') = coalesce(sic.tech_size,'')
     and coalesce(csb.barcode,'') = coalesce(sic.barcode,'')
  ) sic
    on sic.account_id = rw.account_id
   and sic.supply_id = rw.gi_id
   and sic.nm_id = rw.nm_id
   and sic.vendor_code_norm = core.normalize_size(rw.sa_name)
   and sic.canonical_ts_name_norm = core.normalize_size(rw.ts_name)
  where rw.account_id = :account_id
    and rw.rr_dt between :date_from and :date_to
  group by rw.account_id, rw.rr_dt, rw.nm_id, core.normalize_size(rw.ts_name)
)
select
  'cogs top diff' as check_name,
  coalesce(o.account_id, n.account_id) as account_id,
  coalesce(o.calendar_date, n.calendar_date) as calendar_date,
  coalesce(o.nm_id, n.nm_id) as nm_id,
  coalesce(o.ts_name, n.ts_name) as ts_name,
  coalesce(o.cogs_old, 0) as cogs_old,
  coalesce(n.cogs_new, 0) as cogs_new,
  coalesce(n.cogs_new, 0) - coalesce(o.cogs_old, 0) as diff
from old_cogs o
full join new_cogs n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.ts_name
order by abs(coalesce(n.cogs_new, 0) - coalesce(o.cogs_old, 0)) desc
limit 50;

-- ========================================
-- 11) PAID STORAGE OLD VS NEW
-- ========================================
-- OLD: size_norm ↔ ts_name (string match)
-- NEW: size_mapping.canonical_ts_name with fallback to normalized source size
-- DIFF: mismatches indicate mapping gaps after safe fallback

-- 11.1) TOTAL
with old_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    core.normalize_size(psc.size) as size_norm,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_old
  from core.paid_storage_costs psc
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by psc.account_id, psc.report_date, psc.nm_id, core.normalize_size(psc.size)
),
new_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    ) as ts_name,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_new
  from core.paid_storage_costs psc
  left join core.size_mapping sm
    on sm.account_id = psc.account_id
   and sm.nm_id = psc.nm_id
   and sm.source_system = 'paid_storage'
   and core.normalize_size(sm.source_size_value) = core.normalize_size(psc.size)
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by
    psc.account_id,
    psc.report_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    )
)
select
  'paid_storage total old vs new' as check_name,
  coalesce(sum(o.storage_old), 0) as storage_old,
  coalesce(sum(n.storage_new), 0) as storage_new,
  coalesce(sum(n.storage_new), 0) - coalesce(sum(o.storage_old), 0) as diff
from old_ps o
full join new_ps n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.size_norm;

-- 11.2) SKU LEVEL
with old_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    core.normalize_size(psc.size) as size_norm,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_old
  from core.paid_storage_costs psc
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by psc.account_id, psc.report_date, psc.nm_id, core.normalize_size(psc.size)
),
new_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    ) as ts_name,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_new
  from core.paid_storage_costs psc
  left join core.size_mapping sm
    on sm.account_id = psc.account_id
   and sm.nm_id = psc.nm_id
   and sm.source_system = 'paid_storage'
   and core.normalize_size(sm.source_size_value) = core.normalize_size(psc.size)
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by
    psc.account_id,
    psc.report_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    )
)
select
  'paid_storage sku level' as check_name,
  coalesce(o.account_id, n.account_id) as account_id,
  coalesce(o.calendar_date, n.calendar_date) as calendar_date,
  coalesce(o.nm_id, n.nm_id) as nm_id,
  coalesce(n.ts_name, o.size_norm) as ts_name,
  coalesce(o.storage_old, 0) as storage_old,
  coalesce(n.storage_new, 0) as storage_new,
  coalesce(n.storage_new, 0) - coalesce(o.storage_old, 0) as diff
from old_ps o
full join new_ps n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.size_norm;

-- 11.3) TOP DIFF
with old_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    core.normalize_size(psc.size) as size_norm,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_old
  from core.paid_storage_costs psc
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by psc.account_id, psc.report_date, psc.nm_id, core.normalize_size(psc.size)
),
new_ps as (
  select
    psc.account_id,
    psc.report_date as calendar_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    ) as ts_name,
    sum(coalesce(psc.warehouse_price,0))::numeric as storage_new
  from core.paid_storage_costs psc
  left join core.size_mapping sm
    on sm.account_id = psc.account_id
   and sm.nm_id = psc.nm_id
   and sm.source_system = 'paid_storage'
   and core.normalize_size(sm.source_size_value) = core.normalize_size(psc.size)
  where psc.account_id = :account_id
    and psc.report_date between :date_from and :date_to
  group by
    psc.account_id,
    psc.report_date,
    psc.nm_id,
    coalesce(
      core.normalize_size(sm.canonical_ts_name),
      core.normalize_size(psc.size)
    )
)
select
  'paid_storage top diff' as check_name,
  coalesce(o.account_id, n.account_id) as account_id,
  coalesce(o.calendar_date, n.calendar_date) as calendar_date,
  coalesce(o.nm_id, n.nm_id) as nm_id,
  coalesce(n.ts_name, o.size_norm) as ts_name,
  coalesce(o.storage_old, 0) as storage_old,
  coalesce(n.storage_new, 0) as storage_new,
  coalesce(n.storage_new, 0) - coalesce(o.storage_old, 0) as diff
from old_ps o
full join new_ps n
  on n.account_id = o.account_id
 and n.calendar_date = o.calendar_date
 and n.nm_id = o.nm_id
 and n.ts_name = o.size_norm
order by abs(coalesce(n.storage_new, 0) - coalesce(o.storage_old, 0)) desc
limit 50;
