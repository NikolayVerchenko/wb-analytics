import { computed, reactive } from 'vue'
import { apiUrl } from '../api/http'

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
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
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
