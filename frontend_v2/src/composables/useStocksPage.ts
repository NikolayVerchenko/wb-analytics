import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { DashboardMetricView } from '../types/dashboard'
import type { StockItem, StockTotals } from '../types/stocks'
import { getStockItems } from '../api/stocks'
import { formatNumber } from '../utils/format'

const STOCKS_POLL_MS = 30_000

export function useStocksPage() {
  const route = useRoute()
  const items = ref<StockItem[]>([])
  const totals = ref<StockTotals | null>(null)
  const loading = ref(false)
  const error = ref('')
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  const accountId = computed(() =>
    typeof route.query.account_id === 'string' ? route.query.account_id : '',
  )

  const empty = computed(() => !loading.value && !error.value && items.value.length === 0)

  const lastUpdatedLabel = computed(() => {
    const raw = totals.value?.snapshot_loaded_at
    if (!raw) {
      return ''
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return ''
    }
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(parsed)
  })

  const dashboardMetrics = computed<DashboardMetricView[]>(() => {
    if (!totals.value) {
      return []
    }

    return [
      { key: 'total_on_warehouses', label: 'На складах', value: formatNumber(totals.value.total_on_warehouses) },
      { key: 'in_transit_to_customer', label: 'До клиента', value: formatNumber(totals.value.in_transit_to_customer) },
      { key: 'in_transit_from_customer', label: 'Возвраты в пути', value: formatNumber(totals.value.in_transit_from_customer) },
      { key: 'total_stock', label: 'Общий остаток', value: formatNumber(totals.value.total_stock) },
      { key: 'stock_cogs_total', label: 'Себестоимость остатка', value: formatNumber(totals.value.stock_cogs_total) },
    ]
  })

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function scheduleNextPoll() {
    clearPollTimer()
    if (!accountId.value) {
      return
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    pollTimer = setTimeout(() => {
      void load({ silent: true })
    }, STOCKS_POLL_MS)
  }

  async function load(options: { silent?: boolean } = {}) {
    if (!accountId.value) {
      clearPollTimer()
      items.value = []
      totals.value = null
      return
    }

    if (loading.value) {
      return
    }

    clearPollTimer()
    if (!options.silent) {
      loading.value = true
      error.value = ''
    }

    try {
      const response = await getStockItems({
        account_id: accountId.value,
        limit: 1000,
        offset: 0,
      })
      items.value = response.items
      totals.value = response.totals
      if (options.silent) {
        error.value = ''
      }
    } catch (err) {
      if (!options.silent) {
        items.value = []
        totals.value = null
      }
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить остатки.'
    } finally {
      loading.value = false
      scheduleNextPoll()
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      clearPollTimer()
      return
    }
    void load({ silent: true })
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  onBeforeUnmount(() => {
    clearPollTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  watch(accountId, async () => {
    await load()
  }, { immediate: true })

  return {
    accountId,
    items,
    totals,
    loading,
    error,
    empty,
    dashboardMetrics,
    lastUpdatedLabel,
    reload: load,
  }
}
