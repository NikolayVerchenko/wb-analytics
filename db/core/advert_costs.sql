create schema if not exists core;

create table if not exists core.advert_costs (
    id bigserial primary key,
    account_id uuid not null references core.accounts(account_id) on delete cascade,
    advert_id bigint not null,
    upd_num bigint not null,
    upd_time timestamptz,
    upd_sum numeric,
    period_from date,
    period_to date,
    raw_load_id uuid,
    loaded_at timestamptz not null default now()
);

create sequence if not exists core.advert_costs_id_seq;

alter table core.advert_costs
    add column if not exists id bigint,
    add column if not exists account_id uuid,
    add column if not exists advert_id bigint,
    add column if not exists upd_num bigint,
    add column if not exists upd_time timestamptz,
    add column if not exists upd_sum numeric,
    add column if not exists period_from date,
    add column if not exists period_to date,
    add column if not exists raw_load_id uuid,
    add column if not exists loaded_at timestamptz;

alter sequence core.advert_costs_id_seq owned by core.advert_costs.id;

alter table core.advert_costs
    alter column id set default nextval('core.advert_costs_id_seq'),
    alter column loaded_at set default now();

update core.advert_costs
set id = nextval('core.advert_costs_id_seq')
where id is null;

select setval(
    'core.advert_costs_id_seq',
    greatest(coalesce((select max(id) from core.advert_costs), 0), 1),
    true
);

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'core.advert_costs'::regclass
          and conname = 'advert_costs_pkey'
    ) then
        alter table core.advert_costs drop constraint advert_costs_pkey;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'core.advert_costs'::regclass
          and conname = 'advert_costs_id_pkey'
    ) then
        alter table core.advert_costs
            add constraint advert_costs_id_pkey primary key (id);
    end if;
end $$;

create index if not exists advert_costs_time_idx
    on core.advert_costs (account_id, upd_time);

create index if not exists advert_costs_advert_doc_idx
    on core.advert_costs (account_id, advert_id, upd_num);
