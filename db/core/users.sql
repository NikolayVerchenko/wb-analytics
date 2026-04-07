create table if not exists core.users (
    user_id uuid primary key,
    email text not null,
    password_hash text not null,
    status text not null default 'active',
    created_at timestamptz not null default now()
);

alter table core.users
    add column if not exists name text null,
    add column if not exists phone text null,
    add column if not exists updated_at timestamptz null;

create index if not exists users_status_idx on core.users (status);
create unique index if not exists users_email_lower_uidx on core.users (lower(email));
