create table if not exists core.auth_sessions (
    id uuid primary key,
    user_id uuid not null references core.users(user_id) on delete cascade,
    refresh_token_hash text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    revoked_at timestamptz null
);

create index if not exists auth_sessions_user_id_idx on core.auth_sessions (user_id);
create index if not exists auth_sessions_expires_at_idx on core.auth_sessions (expires_at);
