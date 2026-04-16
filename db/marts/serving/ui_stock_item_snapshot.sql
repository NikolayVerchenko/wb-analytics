create schema if not exists mart;

create table if not exists mart.ui_stock_item_snapshot (
    account_id uuid not null,
    nm_id integer not null,
    vendor_code text not null,
    barcode text not null,
    tech_size text not null,
    brand_name text,
    subject_name text,
    photo_url text,
    snapshot_loaded_at timestamptz,
    total_on_warehouses numeric,
    in_transit_to_customer numeric,
    in_transit_from_customer numeric,
    total_stock numeric,
    cogs_per_unit numeric,
    stock_cogs_on_warehouses numeric,
    stock_cogs_to_customer numeric,
    stock_cogs_returns_in_transit numeric,
    stock_cogs_total numeric
);

alter table mart.ui_stock_item_snapshot add column if not exists cogs_per_unit numeric;
alter table mart.ui_stock_item_snapshot add column if not exists stock_cogs_on_warehouses numeric;
alter table mart.ui_stock_item_snapshot add column if not exists stock_cogs_to_customer numeric;
alter table mart.ui_stock_item_snapshot add column if not exists stock_cogs_returns_in_transit numeric;
alter table mart.ui_stock_item_snapshot add column if not exists stock_cogs_total numeric;

create unique index if not exists ui_stock_item_snapshot_pk
    on mart.ui_stock_item_snapshot (account_id, nm_id, vendor_code, barcode, tech_size);

create index if not exists ui_stock_item_snapshot_account_idx
    on mart.ui_stock_item_snapshot (account_id);

create index if not exists ui_stock_item_snapshot_account_vendor_idx
    on mart.ui_stock_item_snapshot (account_id, vendor_code);

create index if not exists ui_stock_item_snapshot_account_brand_idx
    on mart.ui_stock_item_snapshot (account_id, brand_name);

create index if not exists ui_stock_item_snapshot_account_subject_idx
    on mart.ui_stock_item_snapshot (account_id, subject_name);

truncate table mart.ui_stock_item_snapshot;

with primary_photos as (
    select
        p.account_id,
        p.nm_id,
        p.photo_url
    from core.product_card_photos p
    where p.photo_index = 1
),
latest_cost_candidates as (
    select
        sic.account_id,
        sic.nm_id,
        btrim(lower(coalesce(sic.vendor_code, ''))) as vendor_code,
        core.normalize_size(sic.tech_size) as tech_size,
        btrim(coalesce(sic.barcode, '')) as barcode,
        sic.unit_cogs,
        coalesce(si.fact_date, si.supply_date, si.create_date, si.updated_date) as supply_sort_ts,
        sic.updated_at,
        row_number() over (
            partition by
                sic.account_id,
                sic.nm_id,
                btrim(lower(coalesce(sic.vendor_code, ''))),
                core.normalize_size(sic.tech_size),
                btrim(coalesce(sic.barcode, ''))
            order by
                coalesce(si.fact_date, si.supply_date, si.create_date, si.updated_date) desc nulls last,
                sic.updated_at desc,
                sic.supply_id desc
        ) as rn
    from core.account_supply_item_costs sic
    left join mart.supply_items si
      on si.account_id = sic.account_id
     and si.supply_id = sic.supply_id
     and si.nm_id = sic.nm_id
     and btrim(lower(coalesce(si.vendor_code, ''))) = btrim(lower(coalesce(sic.vendor_code, '')))
     and core.normalize_size(si.tech_size) = core.normalize_size(sic.tech_size)
     and btrim(coalesce(si.barcode, '')) = btrim(coalesce(sic.barcode, ''))
),
exact_costs as (
    select
        account_id,
        nm_id,
        vendor_code,
        tech_size,
        barcode,
        unit_cogs,
        supply_sort_ts,
        updated_at
    from latest_cost_candidates
    where rn = 1
),
size_costs as (
    select
        account_id,
        nm_id,
        vendor_code,
        tech_size,
        unit_cogs
    from (
        select
            account_id,
            nm_id,
            vendor_code,
            tech_size,
            unit_cogs,
            row_number() over (
                partition by account_id, nm_id, vendor_code, tech_size
                order by supply_sort_ts desc nulls last, updated_at desc
            ) as rn
        from exact_costs
    ) t
    where rn = 1
),
article_costs as (
    select
        account_id,
        nm_id,
        vendor_code,
        unit_cogs
    from (
        select
            account_id,
            nm_id,
            vendor_code,
            unit_cogs,
            row_number() over (
                partition by account_id, nm_id, vendor_code
                order by supply_sort_ts desc nulls last, updated_at desc
            ) as rn
        from exact_costs
    ) t
    where rn = 1
),
normalized as (
    select
        w.account_id,
        w.nm_id,
        btrim(lower(coalesce(w.vendor_code, pc.vendor_code, ''))) as vendor_code,
        btrim(coalesce(w.barcode, '')) as barcode,
        core.normalize_size(w.tech_size) as tech_size,
        coalesce(nullif(btrim(w.brand), ''), nullif(btrim(pc.brand), '')) as brand_name,
        coalesce(nullif(btrim(w.subject_name), ''), nullif(btrim(pc.subject_name), '')) as subject_name,
        pp.photo_url,
        w.loaded_at as snapshot_loaded_at,
        coalesce(w.total_on_warehouses, 0)::numeric as total_on_warehouses,
        coalesce(w.in_transit_to_customer, 0)::numeric as in_transit_to_customer,
        coalesce(w.in_transit_from_customer, 0)::numeric as in_transit_from_customer,
        coalesce(ec.unit_cogs, sc.unit_cogs, ac.unit_cogs)::numeric as cogs_per_unit
    from core.warehouse_remains_items w
    left join core.product_cards pc
      on pc.account_id = w.account_id
     and pc.nm_id = w.nm_id
    left join primary_photos pp
      on pp.account_id = w.account_id
     and pp.nm_id = w.nm_id
    left join exact_costs ec
      on ec.account_id = w.account_id
     and ec.nm_id = w.nm_id
     and ec.vendor_code = btrim(lower(coalesce(w.vendor_code, pc.vendor_code, '')))
     and ec.tech_size = core.normalize_size(w.tech_size)
     and ec.barcode = btrim(coalesce(w.barcode, ''))
    left join size_costs sc
      on sc.account_id = w.account_id
     and sc.nm_id = w.nm_id
     and sc.vendor_code = btrim(lower(coalesce(w.vendor_code, pc.vendor_code, '')))
     and sc.tech_size = core.normalize_size(w.tech_size)
    left join article_costs ac
      on ac.account_id = w.account_id
     and ac.nm_id = w.nm_id
     and ac.vendor_code = btrim(lower(coalesce(w.vendor_code, pc.vendor_code, '')))
)
insert into mart.ui_stock_item_snapshot (
    account_id,
    nm_id,
    vendor_code,
    barcode,
    tech_size,
    brand_name,
    subject_name,
    photo_url,
    snapshot_loaded_at,
    total_on_warehouses,
    in_transit_to_customer,
    in_transit_from_customer,
    total_stock,
    cogs_per_unit,
    stock_cogs_on_warehouses,
    stock_cogs_to_customer,
    stock_cogs_returns_in_transit,
    stock_cogs_total
)
select
    account_id,
    nm_id,
    vendor_code,
    barcode,
    tech_size,
    max(brand_name) as brand_name,
    max(subject_name) as subject_name,
    max(photo_url) as photo_url,
    max(snapshot_loaded_at) as snapshot_loaded_at,
    sum(total_on_warehouses)::numeric as total_on_warehouses,
    sum(in_transit_to_customer)::numeric as in_transit_to_customer,
    sum(in_transit_from_customer)::numeric as in_transit_from_customer,
    (sum(total_on_warehouses) + sum(in_transit_to_customer) + sum(in_transit_from_customer))::numeric as total_stock,
    case
        when (sum(total_on_warehouses) + sum(in_transit_to_customer) + sum(in_transit_from_customer)) = 0 then null
        when sum(coalesce(cogs_per_unit, 0) * (total_on_warehouses + in_transit_to_customer + in_transit_from_customer)) = 0 then null
        else round(
            sum(coalesce(cogs_per_unit, 0) * (total_on_warehouses + in_transit_to_customer + in_transit_from_customer))
            / nullif(sum(total_on_warehouses + in_transit_to_customer + in_transit_from_customer), 0),
            2
        )
    end::numeric as cogs_per_unit,
    sum(coalesce(cogs_per_unit, 0) * total_on_warehouses)::numeric as stock_cogs_on_warehouses,
    sum(coalesce(cogs_per_unit, 0) * in_transit_to_customer)::numeric as stock_cogs_to_customer,
    sum(coalesce(cogs_per_unit, 0) * in_transit_from_customer)::numeric as stock_cogs_returns_in_transit,
    sum(coalesce(cogs_per_unit, 0) * (total_on_warehouses + in_transit_to_customer + in_transit_from_customer))::numeric as stock_cogs_total
from normalized
group by account_id, nm_id, vendor_code, barcode, tech_size
having not (
    sum(total_on_warehouses) = 0
    and sum(in_transit_to_customer) = 0
    and sum(in_transit_from_customer) = 0
);
