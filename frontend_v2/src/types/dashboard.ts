export type DashboardMetric = {
  key: string
  label: string
  current: number | null
  previous?: number | null
  delta?: number | null
  delta_percent?: number | null
}

export type DashboardResponse = {
  date_from: string
  date_to: string
  previous_date_from?: string | null
  previous_date_to?: string | null
  metrics: DashboardMetric[]
}

export type GetDashboardParams = {
  account_id: string
  date_from: string
  date_to: string
  subjects?: string[]
  brands?: string[]
  articles?: string[]
  compare_previous?: boolean
}

export type DashboardMetricView = {
  key: string
  label: string
  value: string
  previous?: string
  delta?: string
  hint?: string
}
