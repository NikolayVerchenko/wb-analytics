create schema if not exists core;

create table if not exists core.account_tax_settings (
    account_id uuid primary key references core.accounts(account_id) on delete cascade,
    tax_rate numeric(7,6) not null check (tax_rate >= 0 and tax_rate <= 1),
    tax_base text not null default 'realization_after_spp',
    effective_from date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
