create schema if not exists core;

create table if not exists core.users (
    user_id uuid primary key,
    email text not null,
    password_hash text not null,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    name text,
    phone text,
    updated_at timestamptz
);

create index if not exists users_status_idx on core.users (status);
create unique index if not exists users_email_lower_uidx on core.users (lower(email));

create table if not exists core.accounts (
    account_id uuid primary key,
    name text not null,
    wb_token text,
    status text not null default 'active',
    created_at timestamptz not null default now()
);

create index if not exists accounts_status_idx on core.accounts (status);

create table if not exists core.user_accounts (
    user_id uuid not null references core.users(user_id) on delete cascade,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    role text not null default 'viewer',
    created_at timestamptz not null default now(),
    primary key (user_id, account_id)
);

create index if not exists idx_user_accounts_account
    on core.user_accounts (account_id);

create table if not exists core.seller_info (
    account_id uuid primary key references core.accounts(account_id) on delete cascade,
    wb_seller_id text,
    seller_name text,
    trade_mark text,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create unique index if not exists seller_info_wb_seller_id_uidx
    on core.seller_info (wb_seller_id)
    where wb_seller_id is not null;

create table if not exists core.report_detail_daily (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    rrd_id bigint not null,
    rr_dt date not null,
    vendor_code text,
    size_norm text,
    revenue numeric,
    commission numeric,
    logistics numeric,
    storage numeric,
    penalties numeric,
    services numeric,
    week_start date,
    gi_id bigint,
    subject_name text,
    nm_id bigint,
    brand_name text,
    sa_name text,
    ts_name text,
    quantity integer,
    retail_price numeric,
    retail_amount numeric,
    supplier_oper_name text,
    delivery_amount integer,
    return_amount integer,
    delivery_rub numeric,
    ppvz_for_pay numeric,
    acquiring_fee numeric,
    bonus_type_name text,
    penalty numeric,
    additional_payment numeric,
    cashback_amount numeric,
    loaded_at timestamptz not null default now(),
    primary key (account_id, rrd_id)
);

create index if not exists idx_rdd_daily_week
    on core.report_detail_daily (account_id, week_start);
create index if not exists idx_rdd_daily_date
    on core.report_detail_daily (account_id, rr_dt);

create table if not exists core.report_detail_weekly (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    rrd_id bigint not null,
    rr_dt date not null,
    vendor_code text,
    size_norm text,
    revenue numeric,
    commission numeric,
    logistics numeric,
    storage numeric,
    penalties numeric,
    services numeric,
    week_start date,
    gi_id bigint,
    subject_name text,
    nm_id bigint,
    brand_name text,
    sa_name text,
    ts_name text,
    quantity integer,
    retail_price numeric,
    retail_amount numeric,
    supplier_oper_name text,
    delivery_amount integer,
    return_amount integer,
    delivery_rub numeric,
    ppvz_for_pay numeric,
    acquiring_fee numeric,
    bonus_type_name text,
    penalty numeric,
    additional_payment numeric,
    cashback_amount numeric,
    loaded_at timestamptz not null default now(),
    primary key (account_id, rrd_id)
);

create index if not exists idx_rdd_weekly_week
    on core.report_detail_weekly (account_id, week_start);
create index if not exists idx_rdd_weekly_date
    on core.report_detail_weekly (account_id, rr_dt);

create table if not exists core.product_cards (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    vendor_code text,
    subject_name text,
    brand text,
    weight_brutto numeric,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, nm_id)
);

create index if not exists product_cards_vendor_code_idx
    on core.product_cards (account_id, vendor_code);

create table if not exists core.product_card_colors (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    color text not null,
    color_index integer not null,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, nm_id, color_index)
);

create table if not exists core.product_card_photos (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    photo_index integer not null,
    photo_url text not null,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, nm_id, photo_index)
);

create table if not exists core.product_card_sizes (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    tech_size text not null,
    size_index integer not null,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, nm_id, tech_size)
);

create table if not exists core.adverts (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    advert_id bigint not null,
    campaign_name text,
    payment_type text,
    status integer,
    bid_type text,
    created_at_wb timestamptz,
    started_at_wb timestamptz,
    updated_at_wb timestamptz,
    deleted_at_wb timestamptz,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, advert_id)
);

create table if not exists core.advert_nms (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    advert_id bigint not null,
    nm_id bigint not null,
    subject_id integer,
    subject_name text,
    bid_search_kopecks integer,
    bid_recommendations_kopecks integer,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, advert_id, nm_id),
    foreign key (account_id, advert_id) references core.adverts(account_id, advert_id) on delete cascade
);

create index if not exists advert_nms_nm_idx
    on core.advert_nms (account_id, nm_id);

create table if not exists core.advert_costs (
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    advert_id bigint not null,
    upd_num bigint not null,
    upd_time timestamptz,
    upd_sum numeric,
    period_from date,
    period_to date,
    raw_load_id uuid,
    loaded_at timestamptz not null default now(),
    primary key (account_id, advert_id, upd_num)
);

create index if not exists advert_costs_time_idx
    on core.advert_costs (account_id, upd_time);

create table if not exists core.acceptance_costs (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    nm_id bigint not null,
    income_id bigint,
    item_count integer,
    gi_create_date date,
    shk_create_date date,
    subject_name text,
    total_cost numeric,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create unique index if not exists acceptance_costs_identity_uidx
    on core.acceptance_costs (account_id, nm_id, coalesce(income_id, -1), coalesce(gi_create_date, '1970-01-01'::date), coalesce(shk_create_date, '1970-01-01'::date));

create index if not exists acceptance_costs_date_idx
    on core.acceptance_costs (account_id, coalesce(shk_create_date, gi_create_date));

create table if not exists core.paid_storage_costs (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    report_date date not null,
    nm_id bigint not null,
    vendor_code text,
    size text,
    warehouse_price numeric,
    warehouse text,
    office_id integer,
    barcode text,
    subject text,
    brand text,
    chrt_id bigint,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create index if not exists paid_storage_costs_period_idx
    on core.paid_storage_costs (account_id, report_date, nm_id);
