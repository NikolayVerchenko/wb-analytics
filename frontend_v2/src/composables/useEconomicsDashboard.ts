import { computed, ref } from 'vue'
import { getEconomicsDashboard } from '../api/dashboard'
import type { EconomicsFiltersValue } from '../types/filters'
import type { DashboardMetricView, DashboardResponse } from '../types/dashboard'
import { formatNumber, formatPercent } from '../utils/format'

const PERCENT_KEYS = new Set(['buyout_percent', 'spp_percent', 'wb_commission_percent', 'margin_percent', 'roi_percent', 'delta_percent'])

function formatDashboardValue(key: string, value: number | null | undefined) {
  if (PERCENT_KEYS.has(key)) {
    return formatPercent(value)
  }

  return formatNumber(value)
}

export function useEconomicsDashboard() {
  const dashboard = ref<DashboardResponse | null>(null)
  const loading = ref(false)
  const error = ref('')

  const dashboardMetrics = computed<DashboardMetricView[]>(() => {
    if (!dashboard.value) {
      return []
    }

    return dashboard.value.metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: formatDashboardValue(metric.key, metric.current),
      previous: metric.previous === undefined ? undefined : formatDashboardValue(metric.key, metric.previous),
      delta:
        metric.delta === undefined
          ? undefined
          : `${metric.delta !== null && metric.delta > 0 ? '+' : ''}${formatDashboardValue(metric.key, metric.delta)}`,
    }))
  })

  async function loadDashboard(params: {
    accountId: string
    dateFrom: string
    dateTo: string
    filters: EconomicsFiltersValue
    comparePrevious?: boolean
  }) {
    if (!params.accountId) {
      dashboard.value = null
      return
    }

    loading.value = true
    error.value = ''

    try {
      dashboard.value = await getEconomicsDashboard({
        account_id: params.accountId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        subjects: params.filters.subjects,
        brands: params.filters.brands,
        articles: params.filters.articles,
        compare_previous: params.comparePrevious ?? true,
      })
    } catch (err) {
      dashboard.value = null
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить дашборд.'
    } finally {
      loading.value = false
    }
  }

  return {
    dashboard,
    dashboardMetrics,
    loading,
    error,
    loadDashboard,
  }
}
