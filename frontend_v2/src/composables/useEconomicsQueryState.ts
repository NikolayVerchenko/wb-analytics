import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EconomicsFiltersValue } from '../types/filters'
import { buildEconomicsQuery, parseEconomicsQuery } from '../utils/economicsQuery'

export function useEconomicsQueryState() {
  const route = useRoute()
  const router = useRouter()

  const selectedFilters = ref<EconomicsFiltersValue>({
    subjects: [],
    brands: [],
    articles: [],
  })

  const form = ref({
    date_from: '',
    date_to: '',
  })

  const accountId = ref(typeof route.query.account_id === 'string' ? route.query.account_id : '')

  function syncStateFromQuery() {
    accountId.value = typeof route.query.account_id === 'string' ? route.query.account_id : ''
    const parsed = parseEconomicsQuery(route.query as Record<string, unknown>)
    form.value.date_from = parsed.date_from
    form.value.date_to = parsed.date_to
    selectedFilters.value = parsed.filters
  }

  async function updateQuery(query: Record<string, string | string[] | undefined>) {
    if (!accountId.value) {
      return
    }

    await router.push({
      path: '/economics',
      query,
    })
  }

  async function handleFiltersApply(filters: EconomicsFiltersValue) {
    await updateQuery(
      buildEconomicsQuery({
        account_id: accountId.value,
        date_from: form.value.date_from,
        date_to: form.value.date_to,
        filters,
      }),
    )
  }

  async function handleFiltersReset() {
    await updateQuery(
      buildEconomicsQuery({
        account_id: accountId.value,
        date_from: form.value.date_from,
        date_to: form.value.date_to,
        filters: { subjects: [], brands: [], articles: [] },
      }),
    )
  }

  async function handlePeriodApply(period: { date_from: string; date_to: string }) {
    await updateQuery(
      buildEconomicsQuery({
        account_id: accountId.value,
        date_from: period.date_from,
        date_to: period.date_to,
        filters: selectedFilters.value,
      }),
    )
  }

  return {
    route,
    accountId,
    form,
    selectedFilters,
    syncStateFromQuery,
    handleFiltersApply,
    handleFiltersReset,
    handlePeriodApply,
  }
}
