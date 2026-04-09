import { clearSession, getAccessToken, refreshSession } from '../auth/store'

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const apiBaseUrl = rawApiBaseUrl ? rawApiBaseUrl.replace(/\/$/, '') : ''

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  if (!path.startsWith('/')) {
    return `${apiBaseUrl}/${path}`
  }

  return `${apiBaseUrl}${path}`
}

async function buildErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)

  if (looksLikeHtml) {
    if (response.status === 504) {
      return 'Сервер не ответил вовремя. Если вы запускали загрузку, обновите статус через несколько секунд: job могла уже создаться.'
    }
    if (response.status === 502 || response.status === 503) {
      return 'Сервер временно недоступен. Повторите действие через несколько секунд.'
    }
    return `Request failed with status ${response.status}`
  }

  if (!text) {
    return `Request failed with status ${response.status}`
  }

  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === 'string' && payload.detail) {
      return payload.detail
    }
  } catch {
    // keep raw text fallback
  }

  return text
}

async function requestWithAuth(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const requestTarget = typeof input === 'string' ? apiUrl(input) : input

  const attempt = async (): Promise<Response> => {
    const headers = new Headers(init.headers ?? {})
    const accessToken = getAccessToken()
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(requestTarget, {
      ...init,
      credentials: 'include',
      headers,
    })
  }

  let response = await attempt()
  if (response.status !== 401) {
    return response
  }

  const refreshed = await refreshSession()
  if (!refreshed) {
    clearSession()
    return response
  }

  response = await attempt()
  if (response.status === 401) {
    clearSession()
  }

  return response
}

export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | string[] | null | undefined>,
): Promise<T> {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') {
        continue
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === '') {
            continue
          }

          searchParams.append(key, item)
        }
        continue
      }

      searchParams.set(key, String(value))
    }
  }

  const requestUrl = searchParams.size > 0 ? `${url}?${searchParams.toString()}` : url
  const response = await requestWithAuth(requestUrl, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  return response.json() as Promise<T>
}

export async function apiPost<TResponse, TBody extends object>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await requestWithAuth(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  return response.json() as Promise<TResponse>
}

export async function apiPut<TResponse, TBody extends object>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await requestWithAuth(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return response.json() as Promise<TResponse>
}
