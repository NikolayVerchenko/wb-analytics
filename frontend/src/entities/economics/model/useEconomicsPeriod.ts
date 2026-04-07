import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccountsStore } from '../../account/model/store'
import { fetchEconomicsPeriodItems, fetchEconomicsPeriodSizes } from '../api/economicsApi'
import type { EconomicsPeriodItem, EconomicsPeriodSize, EconomicsPeriodTotals } from './types'
import { getQueryDate, replaceQuery } from '../../../shared/lib/queryState'

const DEFAULT_DATE_FROM = '2026-03-02'
const DEFAULT_DATE_TO = '2026-03-08'

export function useEconomicsPeriod() {
  const accountsStore = useAccountsStore()
  const route = useRoute()
  const router = useRouter()
  const items = ref<EconomicsPeriodItem[]>([])
  const totals = ref<EconomicsPeriodTotals | null>(null)
  const sizeItems = ref<Record<string, EconomicsPeriodSize[]>>({})
  const sizeErrors = ref<Record<string, string | null>>({})
  const expandedKeys = ref<string[]>([])
  const loadingSizeKeys = ref<string[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const dateFrom = ref(getQueryDate(route.query.date_from, DEFAULT_DATE_FROM))
  const dateTo = ref(getQueryDate(route.query.date_to, DEFAULT_DATE_TO))
  let currentItemsAbortController: AbortController | null = null

  const selectedAccountName = computed(
    () => accountsStore.selectedAccount?.seller_name || accountsStore.selectedAccount?.name || null,
  )

  onMounted(async () => {
    await accountsStore.initialize()
    await syncFiltersFromRoute()
    await loadItems()
  })

  watch(
    () => accountsStore.selectedAccountId,
    async (nextAccountId, previousAccountId) => {
      if (nextAccountId && nextAccountId !== previousAccountId) {
        await loadItems()
      }
    },
  )

  watch(
    () => route.query,
    async () => {
      const nextDateFrom = getQueryDate(route.query.date_from, DEFAULT_DATE_FROM)
      const nextDateTo = getQueryDate(route.query.date_to, DEFAULT_DATE_TO)
      const changed = nextDateFrom !== dateFrom.value || nextDateTo !== dateTo.value
      if (!changed) {
        return
      }
      dateFrom.value = nextDateFrom
      dateTo.value = nextDateTo
      await loadItems()
    },
  )

  async function loadItems() {
    if (!accountsStore.selectedAccountId) {
      items.value = []
      totals.value = null
      resetSizeState()
      return
    }

    currentItemsAbortController?.abort()
    currentItemsAbortController = new AbortController()

    isLoading.value = true
    errorMessage.value = null

    try {
      const response = await fetchEconomicsPeriodItems({
        accountId: accountsStore.selectedAccountId,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        signal: currentItemsAbortController.signal,
      })
      items.value = response.items
      totals.value = response.totals
      resetSizeState()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  async function toggleSizes(item: EconomicsPeriodItem) {
    const key = itemKey(item)
    if (expandedKeys.value.includes(key)) {
      expandedKeys.value = expandedKeys.value.filter((currentKey) => currentKey !== key)
      return
    }

    expandedKeys.value = [...expandedKeys.value, key]

    if (sizeItems.value[key] || !accountsStore.selectedAccountId || !item.vendor_code) {
      return
    }

    loadingSizeKeys.value = [...loadingSizeKeys.value, key]
    sizeErrors.value = { ...sizeErrors.value, [key]: null }

    try {
      const rows = await fetchEconomicsPeriodSizes({
        accountId: accountsStore.selectedAccountId,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        nmId: item.nm_id,
        vendorCode: item.vendor_code,
      })
      sizeItems.value = { ...sizeItems.value, [key]: rows }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      sizeErrors.value = {
        ...sizeErrors.value,
        [key]: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      loadingSizeKeys.value = loadingSizeKeys.value.filter((currentKey) => currentKey !== key)
    }
  }

  async function syncFiltersFromRoute() {
    const nextDateFrom = getQueryDate(route.query.date_from, DEFAULT_DATE_FROM)
    const nextDateTo = getQueryDate(route.query.date_to, DEFAULT_DATE_TO)
    dateFrom.value = nextDateFrom
    dateTo.value = nextDateTo

    if (route.query.date_from === nextDateFrom && route.query.date_to === nextDateTo) {
      return
    }

    await replaceQuery(router, {
      ...route.query,
      date_from: nextDateFrom,
      date_to: nextDateTo,
    })
  }

  async function updateDateFrom(value: string) {
    await setDateRange(value, dateTo.value)
  }

  async function updateDateTo(value: string) {
    await setDateRange(dateFrom.value, value)
  }

  async function setDateRange(nextDateFrom: string, nextDateTo: string) {
    if (nextDateFrom === dateFrom.value && nextDateTo === dateTo.value) {
      return
    }

    await replaceQuery(router, {
      ...route.query,
      date_from: nextDateFrom,
      date_to: nextDateTo,
    })
  }

  function resetSizeState() {
    sizeItems.value = {}
    sizeErrors.value = {}
    expandedKeys.value = []
    loadingSizeKeys.value = []
  }

  return {
    items,
    totals,
    sizeItems,
    sizeErrors,
    expandedKeys,
    loadingSizeKeys,
    isLoading,
    errorMessage,
    dateFrom,
    dateTo,
    selectedAccountName,
    loadItems,
    toggleSizes,
    updateDateFrom,
    updateDateTo,
    setDateRange,
  }
}

function itemKey(item: EconomicsPeriodItem): string {
  return `${item.nm_id}|${item.vendor_code ?? ''}`
}
