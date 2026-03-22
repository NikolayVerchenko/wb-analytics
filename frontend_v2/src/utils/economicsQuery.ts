import type { EconomicsFiltersValue } from '../types/filters'

export type EconomicsQueryState = {
  date_from: string
  date_to: string
  filters: EconomicsFiltersValue
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDefaultEconomicsDates(today = new Date()): Pick<EconomicsQueryState, 'date_from' | 'date_to'> {
  const dateTo = toDateInputValue(today)
  const dateFromValue = new Date(today)
  dateFromValue.setDate(today.getDate() - 30)

  return {
    date_from: toDateInputValue(dateFromValue),
    date_to: dateTo,
  }
}

export function normalizeQueryArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }

  if (typeof value === 'string' && value.length > 0) {
    return [value]
  }

  return []
}

export function parseEconomicsQuery(query: Record<string, unknown>, today = new Date()): EconomicsQueryState {
  const defaults = getDefaultEconomicsDates(today)

  return {
    date_from: typeof query.date_from === 'string' && query.date_from.length > 0 ? query.date_from : defaults.date_from,
    date_to: typeof query.date_to === 'string' && query.date_to.length > 0 ? query.date_to : defaults.date_to,
    filters: {
      subjects: normalizeQueryArray(query.subjects),
      brands: normalizeQueryArray(query.brands),
      articles: normalizeQueryArray(query.articles),
    },
  }
}

export function buildEconomicsQuery(params: {
  account_id: string
  date_from: string
  date_to: string
  filters: EconomicsFiltersValue
}): Record<string, string | string[] | undefined> {
  return {
    account_id: params.account_id,
    date_from: params.date_from,
    date_to: params.date_to,
    subjects: params.filters.subjects.length > 0 ? params.filters.subjects : undefined,
    brands: params.filters.brands.length > 0 ? params.filters.brands : undefined,
    articles: params.filters.articles.length > 0 ? params.filters.articles : undefined,
  }
}
