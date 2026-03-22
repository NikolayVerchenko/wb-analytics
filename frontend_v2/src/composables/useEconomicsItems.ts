import { ref } from 'vue'
import { getPeriodItems } from '../api/economics'
import type { EconomicsFiltersValue } from '../types/filters'
import type { EconomicsItem, EconomicsTotals } from '../types/economics'

export function useEconomicsItems() {
  const items = ref<EconomicsItem[]>([])
  const totals = ref<EconomicsTotals | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadItems(params: {
    accountId: string
    dateFrom: string
    dateTo: string
    filters: EconomicsFiltersValue
    resetDetails: () => void
  }) {
    if (!params.accountId) {
      items.value = []
      totals.value = null
      params.resetDetails()
      return
    }

    loading.value = true
    error.value = ''
    params.resetDetails()

    try {
      const response = await getPeriodItems({
        account_id: params.accountId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        subjects: params.filters.subjects,
        brands: params.filters.brands,
        articles: params.filters.articles,
      })

      items.value = response.items ?? []
      totals.value = response.totals ?? null
    } catch (err) {
      items.value = []
      totals.value = null
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить данные.'
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    totals,
    loading,
    error,
    loadItems,
  }
}
