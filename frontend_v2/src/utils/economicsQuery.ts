import type { EconomicsFiltersValue } from '../types/filters'

export type EconomicsQueryState = {
  date_from: string
  date_to: string
  filters: EconomicsFiltersValue
}

export type EconomicsQueryPrefix = 'table' | 'dashboard'

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

function getQueryKey(prefix: EconomicsQueryPrefix, key: 'date_from' | 'date_to' | 'subjects' | 'brands' | 'articles') {
  return `${prefix}_${key}`
}

function getLegacyValue(query: Record<string, unknown>, prefix: EconomicsQueryPrefix, key: 'date_from' | 'date_to' | 'subjects' | 'brands' | 'articles') {
  if (prefix !== 'table') {
    return undefined
  }

  return query[key]
}

export function parsePrefixedEconomicsQuery(
  query: Record<string, unknown>,
  prefix: EconomicsQueryPrefix,
  today = new Date(),
  fallback?: EconomicsQueryState,
): EconomicsQueryState {
  const defaults = fallback ?? {
    ...getDefaultEconomicsDates(today),
    filters: {
      subjects: [],
      brands: [],
      articles: [],
    },
  }

  const dateFromValue = query[getQueryKey(prefix, 'date_from')] ?? getLegacyValue(query, prefix, 'date_from')
  const dateToValue = query[getQueryKey(prefix, 'date_to')] ?? getLegacyValue(query, prefix, 'date_to')
  const subjectsValue = query[getQueryKey(prefix, 'subjects')] ?? getLegacyValue(query, prefix, 'subjects')
  const brandsValue = query[getQueryKey(prefix, 'brands')] ?? getLegacyValue(query, prefix, 'brands')
  const articlesValue = query[getQueryKey(prefix, 'articles')] ?? getLegacyValue(query, prefix, 'articles')

  const subjects = normalizeQueryArray(subjectsValue)
  const brands = normalizeQueryArray(brandsValue)
  const articles = normalizeQueryArray(articlesValue)

  return {
    date_from: typeof dateFromValue === 'string' && dateFromValue.length > 0 ? dateFromValue : defaults.date_from,
    date_to: typeof dateToValue === 'string' && dateToValue.length > 0 ? dateToValue : defaults.date_to,
    filters: {
      subjects: subjects.length > 0 ? subjects : defaults.filters.subjects,
      brands: brands.length > 0 ? brands : defaults.filters.brands,
      articles: articles.length > 0 ? articles : defaults.filters.articles,
    },
  }
}

export function buildPrefixedEconomicsQuery(params: {
  prefix: EconomicsQueryPrefix
  date_from: string
  date_to: string
  filters: EconomicsFiltersValue
}): Record<string, string | string[] | undefined> {
  return {
    [getQueryKey(params.prefix, 'date_from')]: params.date_from,
    [getQueryKey(params.prefix, 'date_to')]: params.date_to,
    [getQueryKey(params.prefix, 'subjects')]: params.filters.subjects.length > 0 ? params.filters.subjects : undefined,
    [getQueryKey(params.prefix, 'brands')]: params.filters.brands.length > 0 ? params.filters.brands : undefined,
    [getQueryKey(params.prefix, 'articles')]: params.filters.articles.length > 0 ? params.filters.articles : undefined,
  }
}

export function parseEconomicsQuery(query: Record<string, unknown>, today = new Date()): EconomicsQueryState {
  return {
    ...parsePrefixedEconomicsQuery(query, 'table', today),
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
    ...buildPrefixedEconomicsQuery({
      prefix: 'table',
      date_from: params.date_from,
      date_to: params.date_to,
      filters: params.filters,
    }),
  }
}
