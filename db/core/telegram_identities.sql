create table if not exists core.telegram_identities (
    id uuid primary key,
    user_id uuid not null references core.users(user_id) on delete cascade,
    telegram_user_id bigint not null unique,
    telegram_username text null,
    first_name text not null,
    last_name text null,
    photo_url text null,
    auth_date timestamptz not null,
    linked_at timestamptz not null default now(),
    last_seen_at timestamptz null,
    is_verified boolean not null default true
);

create index if not exists telegram_identities_user_id_idx on core.telegram_identities (user_id);
