export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  return `${formatNumber(value)}%`
}
