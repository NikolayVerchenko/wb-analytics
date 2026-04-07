create schema if not exists core;

create table if not exists core.sync_account_schedules (
    schedule_id uuid primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    dataset text not null,
    enabled boolean not null default true,
    interval_minutes integer not null check (interval_minutes > 0),
    next_run_at timestamptz,
    last_success_at timestamptz,
    last_error_at timestamptz,
    last_job_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (account_id, dataset)
);

create index if not exists idx_sync_account_schedules_due
    on core.sync_account_schedules (dataset, enabled, next_run_at);
