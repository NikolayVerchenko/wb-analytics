import http from 'k6/http'
import { check, group, sleep } from 'k6'

function env(name, fallback = '') {
  const v = __ENV[name]
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v)
}

function toISODate(d) {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function defaultDateFrom() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 7)
  return toISODate(d)
}

function defaultDateTo() {
  return toISODate(new Date())
}

const BASE_URL = env('BASE_URL', 'http://127.0.0.1:8010')
const API_PREFIX = env('API_PREFIX', '')

const TEST_EMAIL = env('TEST_EMAIL')
const TEST_PASSWORD = env('TEST_PASSWORD')
const ACCOUNT_ID_OVERRIDE = env('ACCOUNT_ID', '')
const DATE_FROM = env('DATE_FROM', defaultDateFrom())
const DATE_TO = env('DATE_TO', defaultDateTo())
const SYNC_JOB_ID = env('SYNC_JOB_ID', '')

function api(path) {
  const base = BASE_URL.replace(/\/$/, '')
  const prefix = API_PREFIX ? `/${API_PREFIX.replace(/^\/|\/$/g, '')}` : ''
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${prefix}${p}`
}

export const options = {
  scenarios: {
    economics: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: env('RAMP_UP', '1m'), target: Number(env('VUS_ECON', '70')) },
        { duration: env('STEADY', '3m'), target: Number(env('VUS_ECON', '70')) },
        { duration: env('RAMP_DOWN', '30s'), target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'economicsScenario',
    },
    sync_poll: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: env('RAMP_UP', '1m'), target: Number(env('VUS_SYNC', '20')) },
        { duration: env('STEADY', '3m'), target: Number(env('VUS_SYNC', '20')) },
        { duration: env('RAMP_DOWN', '30s'), target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'syncScenario',
    },
    auth_refresh: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: env('RAMP_UP', '1m'), target: Number(env('VUS_AUTH', '10')) },
        { duration: env('STEADY', '3m'), target: Number(env('VUS_AUTH', '10')) },
        { duration: env('RAMP_DOWN', '30s'), target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'authScenario',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
}

function requireCreds() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD env vars for k6 run.')
  }
}

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

/** One login + resolve account_id — avoids auth rate limit (per IP) on every iteration. */
export function setup() {
  requireCreds()

  const payload = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  const loginRes = http.post(api('/auth/password/login'), payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_password_login' },
  })
  const loginOk = check(loginRes, {
    'setup login: status 200': (r) => r.status === 200,
    'setup login: has access_token': (r) => {
      try {
        return Boolean(r.json('access_token'))
      } catch (_) {
        return false
      }
    },
  })
  if (!loginOk) {
    throw new Error(`setup: login failed status=${loginRes.status} body=${String(loginRes.body).slice(0, 200)}`)
  }

  const accessToken = loginRes.json('access_token')

  let accountId = ACCOUNT_ID_OVERRIDE.trim()
  if (!accountId) {
    const accRes = http.get(api('/accounts'), {
      headers: authHeaders(accessToken),
      tags: { name: 'accounts_list' },
    })
    const accOk = check(accRes, { 'setup accounts: status 200': (r) => r.status === 200 })
    if (!accOk) {
      throw new Error(`setup: accounts failed status=${accRes.status}`)
    }
    const items = accRes.json()
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('setup: no accounts for user')
    }
    accountId = items[0].id || items[0].account_id
  }

  return { access_token: accessToken, account_id: accountId }
}

export function economicsScenario(data) {
  const accessToken = data.access_token
  const accountId = data.account_id

  group('economics', () => {
    const baseQS = `account_id=${encodeURIComponent(accountId)}&date_from=${DATE_FROM}&date_to=${DATE_TO}`

    const dash1 = http.get(api(`/economics/dashboard?${baseQS}&compare_previous=true`), {
      headers: authHeaders(accessToken),
      tags: { name: 'economics_dashboard' },
    })
    check(dash1, { 'dashboard: 200': (r) => r.status === 200 })

    const filters = http.get(api(`/economics/filter-options?${baseQS}`), {
      headers: authHeaders(accessToken),
      tags: { name: 'economics_filter_options' },
    })
    check(filters, { 'filter-options: 200': (r) => r.status === 200 })

    const page1 = http.get(api(`/economics/period-items?${baseQS}&limit=200&offset=0`), {
      headers: authHeaders(accessToken),
      tags: { name: 'economics_period_items' },
    })
    check(page1, { 'period-items: 200': (r) => r.status === 200 })

    const onlyNeg = __VU % 2 === 0
    const page2 = http.get(
      api(`/economics/period-items?${baseQS}&limit=200&offset=0&only_negative_profit=${onlyNeg}`),
      {
        headers: authHeaders(accessToken),
        tags: { name: 'economics_period_items_filter_change' },
      },
    )
    check(page2, { 'period-items filter: 200': (r) => r.status === 200 })
  })

  sleep(1)
}

export function syncScenario(data) {
  const accessToken = data.access_token
  const accountId = data.account_id

  group('sync', () => {
    const cov = http.get(api(`/sync/coverage?account_id=${encodeURIComponent(accountId)}`), {
      headers: authHeaders(accessToken),
      tags: { name: 'sync_coverage' },
    })
    check(cov, { 'sync coverage: 200': (r) => r.status === 200 })

    if (SYNC_JOB_ID) {
      const details = http.get(api(`/sync/jobs/${encodeURIComponent(SYNC_JOB_ID)}`), {
        headers: authHeaders(accessToken),
        tags: { name: 'sync_job_details' },
      })
      check(details, { 'sync job: 200/404': (r) => r.status === 200 || r.status === 404 })
    }
  })

  sleep(Number(env('SYNC_POLL_SLEEP_SECONDS', '5')))
}

/** Only /auth/me — refresh needs HttpOnly cookie (not modeled here). */
export function authScenario(data) {
  const accessToken = data.access_token

  group('auth', () => {
    const me = http.get(api('/auth/me'), {
      headers: authHeaders(accessToken),
      tags: { name: 'auth_me' },
    })
    check(me, { 'me: 200': (r) => r.status === 200 })
  })

  sleep(3)
}
