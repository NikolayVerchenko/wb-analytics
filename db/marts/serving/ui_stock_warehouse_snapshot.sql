create schema if not exists mart;

create table if not exists mart.ui_stock_warehouse_snapshot (
    account_id uuid not null,
    nm_id integer not null,
    vendor_code text not null,
    barcode text not null,
    tech_size text not null,
    warehouse_name text not null,
    snapshot_loaded_at timestamptz,
    quantity numeric
);

create unique index if not exists ui_stock_warehouse_snapshot_pk
    on mart.ui_stock_warehouse_snapshot (account_id, nm_id, vendor_code, barcode, tech_size, warehouse_name);

create index if not exists ui_stock_warehouse_snapshot_account_idx
    on mart.ui_stock_warehouse_snapshot (account_id);

create index if not exists ui_stock_warehouse_snapshot_drilldown_idx
    on mart.ui_stock_warehouse_snapshot (account_id, nm_id, vendor_code, barcode, tech_size);

truncate table mart.ui_stock_warehouse_snapshot;

insert into mart.ui_stock_warehouse_snapshot (
    account_id,
    nm_id,
    vendor_code,
    barcode,
    tech_size,
    warehouse_name,
    snapshot_loaded_at,
    quantity
)
select
    account_id,
    nm_id,
    btrim(lower(coalesce(vendor_code, ''))) as vendor_code,
    btrim(coalesce(barcode, '')) as barcode,
    core.normalize_size(tech_size) as tech_size,
    btrim(coalesce(warehouse_name, '')) as warehouse_name,
    max(loaded_at) as snapshot_loaded_at,
    sum(coalesce(quantity, 0))::numeric as quantity
from core.warehouse_remains_balances
where nullif(btrim(coalesce(warehouse_name, '')), '') is not null
group by
    account_id,
    nm_id,
    btrim(lower(coalesce(vendor_code, ''))),
    btrim(coalesce(barcode, '')),
    core.normalize_size(tech_size),
    btrim(coalesce(warehouse_name, ''))
having sum(coalesce(quantity, 0)) <> 0;
