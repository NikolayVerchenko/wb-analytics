import type { LocationQuery, LocationQueryValue, Router } from 'vue-router'

export function getQueryString(value: LocationQueryValue | LocationQueryValue[] | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }
  return value || fallback
}

export function getQueryDate(value: LocationQueryValue | LocationQueryValue[] | undefined, fallback: string): string {
  const nextValue = getQueryString(value, fallback)
  return /^\d{4}-\d{2}-\d{2}$/.test(nextValue) ? nextValue : fallback
}

export function getQueryNumber(value: LocationQueryValue | LocationQueryValue[] | undefined): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export async function replaceQuery(router: Router, query: LocationQuery): Promise<void> {
  await router.replace({ query })
}
