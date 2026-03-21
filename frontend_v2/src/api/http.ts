export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') {
        continue
      }

      searchParams.set(key, String(value))
    }
  }

  const requestUrl = searchParams.size > 0 ? `${url}?${searchParams.toString()}` : url
  const response = await fetch(requestUrl, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}
