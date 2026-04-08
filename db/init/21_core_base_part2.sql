create schema if not exists core;

create table if not exists core.product_funnel (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    vendor_code text,
    brand_name text,
    subject_id integer,
    subject_name text,
    product_rating numeric,
    feedback_rating numeric,
    stock_wb integer,
    stock_mp integer,
    stock_balance_sum numeric,
    period_from date not null,
    period_to date not null,
    open_count integer,
    cart_count integer,
    order_count integer,
    order_sum numeric,
    buyout_count integer,
    buyout_sum numeric,
    cancel_count integer,
    cancel_sum numeric,
    avg_price numeric,
    avg_orders_count_per_day numeric,
    share_order_percent numeric,
    add_to_wishlist integer,
    localization_percent numeric,
    add_to_cart_percent numeric,
    cart_to_order_percent numeric,
    buyout_percent numeric,
    open_count_dynamic numeric,
    cart_count_dynamic numeric,
    order_count_dynamic numeric,
    order_sum_dynamic numeric,
    buyout_count_dynamic numeric,
    buyout_sum_dynamic numeric,
    cancel_count_dynamic numeric,
    cancel_sum_dynamic numeric,
    avg_price_dynamic numeric,
    add_to_wishlist_dynamic numeric,
    localization_percent_dynamic numeric,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, period_from, period_to, nm_id)
);

create index if not exists product_funnel_period_idx
    on core.product_funnel (account_id, period_from, period_to);

create table if not exists core.supplies (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    supply_id bigint,
    preorder_id bigint not null,
    create_date timestamptz,
    supply_date timestamptz,
    fact_date timestamptz,
    updated_date timestamptz,
    status_id integer,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, preorder_id)
);

create unique index if not exists supplies_supply_id_uidx
    on core.supplies (account_id, supply_id)
    where supply_id is not null;

create table if not exists core.supply_goods (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    supply_target_id bigint not null,
    is_preorder_id boolean not null,
    barcode text not null,
    vendor_code text,
    nm_id bigint,
    need_kiz boolean,
    tnved text,
    tech_size text,
    color text,
    supplier_box_amount integer,
    quantity integer,
    ready_for_sale_quantity integer,
    unloading_quantity integer,
    accepted_quantity integer,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create index if not exists supply_goods_target_idx
    on core.supply_goods (account_id, supply_target_id, is_preorder_id);
create index if not exists supply_goods_nm_idx
    on core.supply_goods (account_id, nm_id);

create table if not exists core.warehouse_remains_items (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    vendor_code text,
    brand text,
    subject_name text,
    barcode text not null,
    tech_size text,
    volume numeric,
    in_transit_to_customer numeric,
    in_transit_from_customer numeric,
    total_on_warehouses numeric,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create index if not exists warehouse_remains_items_account_idx
    on core.warehouse_remains_items (account_id, nm_id);

create table if not exists core.warehouse_remains_balances (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    vendor_code text,
    barcode text not null,
    tech_size text,
    warehouse_name text not null,
    quantity numeric,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create index if not exists warehouse_remains_balances_account_idx
    on core.warehouse_remains_balances (account_id, nm_id);

create table if not exists core.wb_offices (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    office_id integer not null,
    name text,
    city text,
    address text,
    longitude numeric,
    latitude numeric,
    cargo_type integer,
    delivery_type integer,
    federal_district text,
    selected boolean,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, office_id)
);
