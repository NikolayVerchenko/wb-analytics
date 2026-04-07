const API_BASE_URL = '/api'

export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(status: number, message: string, detail: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface RequestOptions {
  signal?: AbortSignal
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: string | null = null

  try {
    const payload = await response.json()
    if (typeof payload?.detail === 'string') {
      detail = payload.detail
    } else if (payload?.detail) {
      detail = JSON.stringify(payload.detail)
    }
  } catch {
    detail = null
  }

  return new ApiError(response.status, detail ?? `Request failed: ${response.status}`, detail)
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    signal: options.signal,
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  return response.json() as Promise<T>
}

export async function apiPut<TResponse, TPayload>(
  path: string,
  payload: TPayload,
  options: RequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return response.json() as Promise<TResponse>
}
