import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EconomicsFiltersValue } from '../types/filters'
import { buildPrefixedEconomicsQuery, parsePrefixedEconomicsQuery } from '../utils/economicsQuery'

function hasDashboardQueryNamespace(query: Record<string, unknown>) {
  return Object.keys(query).some((key) => key.startsWith('dashboard_'))
}

export function useEconomicsDashboardQueryState() {
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

  function syncStateFromQuery(tableFallback?: { date_from: string; date_to: string; filters: EconomicsFiltersValue }) {
    accountId.value = typeof route.query.account_id === 'string' ? route.query.account_id : ''

    const query = route.query as Record<string, unknown>
    const parsed = parsePrefixedEconomicsQuery(
      query,
      'dashboard',
      new Date(),
      hasDashboardQueryNamespace(query) ? undefined : tableFallback,
    )

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

  function mergeQuery(partialQuery: Record<string, string | string[] | undefined>) {
    const currentQuery = { ...(route.query as Record<string, string | string[] | undefined>) }

    for (const [key, value] of Object.entries(partialQuery)) {
      if (value === undefined) {
        delete currentQuery[key]
      } else {
        currentQuery[key] = value
      }
    }

    currentQuery.account_id = accountId.value
    return currentQuery
  }

  async function handleFiltersApply(filters: EconomicsFiltersValue) {
    await updateQuery(
      mergeQuery(
        buildPrefixedEconomicsQuery({
          prefix: 'dashboard',
          date_from: form.value.date_from,
          date_to: form.value.date_to,
          filters,
        }),
      ),
    )
  }

  async function handleFiltersReset() {
    await updateQuery(
      mergeQuery(
        buildPrefixedEconomicsQuery({
          prefix: 'dashboard',
          date_from: form.value.date_from,
          date_to: form.value.date_to,
          filters: { subjects: [], brands: [], articles: [] },
        }),
      ),
    )
  }

  async function handlePeriodApply(period: { date_from: string; date_to: string }) {
    await updateQuery(
      mergeQuery(
        buildPrefixedEconomicsQuery({
          prefix: 'dashboard',
          date_from: period.date_from,
          date_to: period.date_to,
          filters: selectedFilters.value,
        }),
      ),
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
