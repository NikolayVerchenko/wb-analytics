export function formatDate(value: string | null): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

export function formatDateRu(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}.${month}.${year}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPeriod(dateFromValue: string, dateToValue: string): string {
  return `${dateFromValue} — ${dateToValue}`
}

export function formatDisplayValue(kind: 'number' | 'money' | 'percent', value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  if (kind === 'percent') {
    return `${formatNumber(Number(value))}%`
  }
  return formatNumber(Number(value))
}
