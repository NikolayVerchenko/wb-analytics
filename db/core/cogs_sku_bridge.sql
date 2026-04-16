create schema if not exists core;

create table if not exists core.cogs_sku_bridge (
    id bigserial primary key,
    account_id uuid not null,
    supply_id bigint not null,
    nm_id bigint not null,
    vendor_code text not null,
    tech_size text,
    barcode text,
    canonical_ts_name text not null,
    mapping_status text not null default 'mapped',
    mapping_method text not null default 'exact_size_name_match',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists cogs_sku_bridge_supply_variant_uidx
    on core.cogs_sku_bridge (
        account_id,
        supply_id,
        nm_id,
        vendor_code,
        coalesce(tech_size, ''),
        coalesce(barcode, '')
    );

create index if not exists cogs_sku_bridge_lookup_idx
    on core.cogs_sku_bridge (account_id, supply_id, nm_id, canonical_ts_name);
