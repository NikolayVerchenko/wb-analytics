create schema if not exists core;

create table if not exists core.sync_job_steps (
    step_id uuid primary key,
    job_id uuid not null references core.sync_jobs(job_id) on delete cascade,
    dataset text not null,
    period_from date not null,
    period_to date not null,
    status text not null,
    attempt integer not null default 1 check (attempt >= 1),
    error_message text,
    next_retry_at timestamptz,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    payload_json jsonb,
    check (period_from <= period_to)
);

create index if not exists idx_sync_job_steps_job_created_at
    on core.sync_job_steps (job_id, created_at, step_id);

create index if not exists idx_sync_job_steps_status
    on core.sync_job_steps (status);
