create schema if not exists raw;

create table if not exists raw.load_runs (
    load_id uuid primary key,
    account_id uuid not null,
    source text not null,
    period_from date not null,
    period_to date not null,
    fetched_at timestamptz not null default now(),
    status text not null default 'success',
    rows_loaded integer not null default 0,
    error text,
    period_mode text,
    week_start date
);

create index if not exists idx_load_runs_account_time
    on raw.load_runs (account_id, fetched_at desc);

create index if not exists idx_load_runs_account_source_period
    on raw.load_runs (account_id, source, period_from, period_to, fetched_at desc);

create table if not exists raw.api_payloads (
    id bigserial primary key,
    load_id uuid not null references raw.load_runs(load_id) on delete cascade,
    account_id uuid not null,
    source text not null,
    fetched_at timestamptz not null default now(),
    request_params jsonb,
    payload jsonb not null,
    payload_hash text,
    period_mode text,
    week_start date
);

create index if not exists idx_api_payloads_load_id
    on raw.api_payloads (load_id);

create index if not exists idx_api_payloads_account_source_time
    on raw.api_payloads (account_id, source, fetched_at desc);
