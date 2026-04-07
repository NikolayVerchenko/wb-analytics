create schema if not exists core;

create table if not exists core.account_supply_item_costs (
    account_id uuid not null,
    supply_id bigint not null,
    nm_id bigint not null,
    vendor_code text not null,
    tech_size text,
    barcode text,
    unit_cogs numeric(12, 2) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (account_id, supply_id, nm_id, vendor_code, tech_size, barcode)
);
