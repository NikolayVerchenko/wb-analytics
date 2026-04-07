import { computed, watch } from 'vue'
import EconomicsTableSkeleton from '../components/EconomicsTableSkeleton.vue'
import { useEconomicsItems } from './useEconomicsItems'
import { useEconomicsTableQueryState } from './useEconomicsTableQueryState'
import { useProblemsEconomicsDiagnostics } from './useProblemsEconomicsDiagnostics'

export function useProblemsEconomicsPage() {
  const tableQueryState = useEconomicsTableQueryState({ path: '/economics/problems' })
  const itemsState = useEconomicsItems()
  const diagnosticsState = useProblemsEconomicsDiagnostics(itemsState.items)

  const loading = computed(() => itemsState.loading.value)
  const error = computed(() => itemsState.error.value)
  const empty = computed(() => !loading.value && !error.value && itemsState.items.value.length === 0)
  const quickFilterEmpty = computed(
    () => !loading.value && !error.value && itemsState.items.value.length > 0 && diagnosticsState.filteredRows.value.length === 0,
  )

  watch(
    () => ({
      accountId: typeof tableQueryState.route.query.account_id === 'string' ? tableQueryState.route.query.account_id : '',
      dateFrom: typeof tableQueryState.route.query.table_date_from === 'string' ? tableQueryState.route.query.table_date_from : '',
      dateTo: typeof tableQueryState.route.query.table_date_to === 'string' ? tableQueryState.route.query.table_date_to : '',
      subjects: tableQueryState.route.query.table_subjects,
      brands: tableQueryState.route.query.table_brands,
      articles: tableQueryState.route.query.table_articles,
    }),
    async () => {
      tableQueryState.syncStateFromQuery()

      await itemsState.loadItems({
        accountId: tableQueryState.accountId.value,
        dateFrom: tableQueryState.form.value.date_from,
        dateTo: tableQueryState.form.value.date_to,
        filters: tableQueryState.selectedFilters.value,
        resetDetails: () => undefined,
      })
    },
    { immediate: true },
  )

  return {
    accountId: tableQueryState.accountId,
    form: tableQueryState.form,
    selectedFilters: tableQueryState.selectedFilters,
    items: itemsState.items,
    totals: itemsState.totals,
    loading,
    error,
    empty,
    quickFilterEmpty,
    quickFilter: diagnosticsState.quickFilter,
    summaryCards: diagnosticsState.summaryCards,
    diagnosticRows: diagnosticsState.diagnosticRows,
    filteredRows: diagnosticsState.filteredRows,
    handleFiltersApply: tableQueryState.handleFiltersApply,
    handleFiltersReset: tableQueryState.handleFiltersReset,
    handlePeriodApply: tableQueryState.handlePeriodApply,
  }
}

