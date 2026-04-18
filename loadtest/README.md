# Load testing

This folder contains a minimal load test setup to validate **~100 concurrent users** for the current stack:

Nginx → FastAPI (Uvicorn) → PgBouncer → Postgres.

## k6 (recommended)

Script: `loadtest/k6/wb_100_users.js`

### Install k6

- Windows: install k6 from the official docs.
- Or run in Docker (if you prefer): `grafana/k6` image.

### Required env vars

- `TEST_EMAIL`: existing user email
- `TEST_PASSWORD`: existing user password

### Target selection (direct backend vs nginx)

- **Direct backend** (local, default):
  - `BASE_URL=http://127.0.0.1:8010`
  - `API_PREFIX=` (empty)

- **Via nginx** (prod-like):
  - `BASE_URL=https://your-domain.ru`
  - `API_PREFIX=/api`

### Optional env vars

- **Pre-selected account** (skips `/accounts` in setup):
  - `ACCOUNT_ID=<uuid>`
- **Date range**:
  - `DATE_FROM=YYYY-MM-DD` (default: last 7 days)
  - `DATE_TO=YYYY-MM-DD` (default: today)
- **Sync job details polling**:
  - `SYNC_JOB_ID=<uuid>` (if set, script will call `/sync/jobs/{id}`)
- **Scenario shaping**:
  - `VUS_ECON` (default `70`)
  - `VUS_SYNC` (default `20`)
  - `VUS_AUTH` (default `10`)
  - `RAMP_UP` (default `1m`)
  - `STEADY` (default `3m`)
  - `RAMP_DOWN` (default `30s`)
  - `SYNC_POLL_SLEEP_SECONDS` (default `5`)

### Run (PowerShell examples)

Direct backend:

```powershell
$env:TEST_EMAIL="user@example.com"
$env:TEST_PASSWORD="password"
$env:BASE_URL="http://127.0.0.1:8010"
$env:API_PREFIX=""
k6 run .\loadtest\k6\wb_100_users.js
```

If you run k6 **inside Docker on Windows/macOS**, use `BASE_URL=http://host.docker.internal:8010` (not `127.0.0.1`) so the container can reach the host API.

Via nginx:

```powershell
$env:TEST_EMAIL="user@example.com"
$env:TEST_PASSWORD="password"
$env:BASE_URL="https://your-domain.ru"
$env:API_PREFIX="/api"
k6 run .\loadtest\k6\wb_100_users.js
```

### Run via Docker (no local k6 install)

Direct backend:

```powershell
$env:TEST_EMAIL="user@example.com"
$env:TEST_PASSWORD="password"

docker run --rm --network host `
  -e TEST_EMAIL="$env:TEST_EMAIL" `
  -e TEST_PASSWORD="$env:TEST_PASSWORD" `
  -e BASE_URL="http://127.0.0.1:8010" `
  -e API_PREFIX="" `
  -v "E:\Sites\wb-analitics_new\loadtest\k6:/scripts" `
  grafana/k6 run /scripts/wb_100_users.js
```

Via nginx:

```powershell
$env:TEST_EMAIL="user@example.com"
$env:TEST_PASSWORD="password"

docker run --rm --network host `
  -e TEST_EMAIL="$env:TEST_EMAIL" `
  -e TEST_PASSWORD="$env:TEST_PASSWORD" `
  -e BASE_URL="https://your-domain.ru" `
  -e API_PREFIX="/api" `
  -v "E:\Sites\wb-analitics_new\loadtest\k6:/scripts" `
  grafana/k6 run /scripts/wb_100_users.js
```

## What it does

- **Setup (once)**: `/auth/password/login` + `/accounts` (or `ACCOUNT_ID`) — then all VUs reuse the same access token (avoids auth **rate limit** on login).
- **Auth**: `/auth/me` (refresh is not simulated: needs HttpOnly cookie)
- **Accounts**: `/accounts` (to get `account_id`)
- **Economics**: `/economics/dashboard`, `/economics/filter-options`, `/economics/period-items`
- **Sync**: `/sync/coverage` (+ optional `/sync/jobs/{id}`)

## Interpreting results (quick checklist)

- Watch k6 p95/p99 latency and error rate.
- In Postgres, watch slow queries, locks, CPU/IO.
- If you see many **429** from nginx under real user behavior, tune `/api` rate limiting and reduce frontend polling/chattiness.

