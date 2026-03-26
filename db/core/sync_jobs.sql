create schema if not exists core;

create table if not exists core.sync_jobs (
    job_id uuid primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    job_type text not null,
    mode text not null,
    date_from date not null,
    date_to date not null,
    status text not null,
    datasets jsonb not null default '[]'::jsonb,
    error_message text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    check (date_from <= date_to)
);

create index if not exists idx_sync_jobs_account_created_at
    on core.sync_jobs (account_id, created_at desc);

create index if not exists idx_sync_jobs_status
    on core.sync_jobs (status);
