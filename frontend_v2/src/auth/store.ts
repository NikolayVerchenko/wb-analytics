import { computed, reactive } from 'vue'
import { apiUrl } from '../api/http'
import { getSelectedAccountId } from './selected-account'

type User = {
  id: string
  name: string | null
  email: string
  status: string
  telegram_linked: boolean
}

type LoginResponse = {
  access_token: string
  user: User
}

type RefreshResponse = {
  access_token: string
  token_type: string
  user: User
}

type AuthState = {
  initialized: boolean
  bootstrapping: boolean
  refreshing: boolean
  user: User | null
  accessToken: string | null
}

export const authState = reactive<AuthState>({
  initialized: false,
  bootstrapping: false,
  refreshing: false,
  user: null,
  accessToken: null,
})

let bootstrapPromise: Promise<void> | null = null
let refreshPromise: Promise<boolean> | null = null

export const isAuthenticated = computed(() => Boolean(authState.user && authState.accessToken))

export async function bootstrapAuth(): Promise<void> {
  if (authState.initialized) {
    return
  }

  if (bootstrapPromise) {
    return bootstrapPromise
  }

  bootstrapPromise = (async () => {
    authState.bootstrapping = true
    try {
      if (!authState.accessToken) {
        const refreshed = await refreshSession()
        if (!refreshed) {
          clearSession()
        }
        return
      }

      try {
        const profile = await fetchMe()
        authState.user = profile
      } catch {
        const refreshed = await refreshSession()
        if (!refreshed) {
          clearSession()
        }
      }
    } catch {
      clearSession()
    } finally {
      authState.initialized = true
      authState.bootstrapping = false
      bootstrapPromise = null
    }
  })()

  return bootstrapPromise
}

export function applyLoginSession(payload: LoginResponse) {
  authState.accessToken = payload.access_token
  authState.user = payload.user
  authState.initialized = true
}

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    authState.refreshing = true
    try {
      const selectedAccountId = getSelectedAccountId()
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: selectedAccountId,
        }),
      })

      if (!response.ok) {
        clearSession()
        return false
      }

      const payload = (await response.json()) as RefreshResponse
      authState.accessToken = payload.access_token
      authState.user = payload.user
      authState.initialized = true
      return true
    } catch {
      clearSession()
      return false
    } finally {
      authState.refreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function scopeAccount(accountId: string): Promise<boolean> {
  const attempt = async (): Promise<Response> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
    })
    const accessToken = getAccessToken()
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(apiUrl('/api/auth/account-scope'), {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ account_id: accountId }),
    })
  }

  let response = await attempt()
  if (response.status === 401) {
    const refreshed = await refreshSession()
    if (!refreshed) {
      clearSession()
      return false
    }
    response = await attempt()
  }

  if (!response.ok) {
    throw new Error('Unable to scope account session.')
  }

  const payload = (await response.json()) as RefreshResponse
  authState.accessToken = payload.access_token
  authState.user = payload.user
  authState.initialized = true
  return true
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // local cleanup still happens
  }

  clearSession()
}

export function clearSession() {
  authState.user = null
  authState.accessToken = null
  authState.initialized = true
}

export function getAccessToken(): string | null {
  return authState.accessToken
}

async function fetchMe(): Promise<User> {
  const response = await fetch(apiUrl('/api/auth/me'), {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Unable to fetch profile.')
  }

  return response.json() as Promise<User>
}

function buildAuthHeaders(): HeadersInit {
  return authState.accessToken
    ? {
        Authorization: `Bearer ${authState.accessToken}`,
      }
    : {}
}
