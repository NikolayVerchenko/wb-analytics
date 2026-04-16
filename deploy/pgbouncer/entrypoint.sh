#!/bin/sh
set -eu

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

export PGBOUNCER_DB_HOST="${PGBOUNCER_DB_HOST:-postgres}"
export PGBOUNCER_DB_PORT="${PGBOUNCER_DB_PORT:-5432}"
export PGBOUNCER_LISTEN_PORT="${PGBOUNCER_LISTEN_PORT:-6432}"
export PGBOUNCER_POOL_MODE="${PGBOUNCER_POOL_MODE:-transaction}"
export PGBOUNCER_MAX_CLIENT_CONN="${PGBOUNCER_MAX_CLIENT_CONN:-500}"
export PGBOUNCER_DEFAULT_POOL_SIZE="${PGBOUNCER_DEFAULT_POOL_SIZE:-30}"
export PGBOUNCER_RESERVE_POOL_SIZE="${PGBOUNCER_RESERVE_POOL_SIZE:-10}"

envsubst < /etc/pgbouncer/pgbouncer.ini.tmpl > /etc/pgbouncer/pgbouncer.ini
envsubst < /etc/pgbouncer/userlist.txt.tmpl > /etc/pgbouncer/userlist.txt

exec "$@"
