import { computed, watch } from 'vue'
import { useEconomicsDashboard } from './useEconomicsDashboard'
import { useEconomicsDashboardQueryState } from './useEconomicsDashboardQueryState'
import { useEconomicsItems } from './useEconomicsItems'
import { useEconomicsSizes } from './useEconomicsSizes'
import { useEconomicsTableQueryState } from './useEconomicsTableQueryState'

export function useEconomicsPage() {
  const tableQueryState = useEconomicsTableQueryState()
  const dashboardQueryState = useEconomicsDashboardQueryState()
  const itemsState = useEconomicsItems()
  const dashboardState = useEconomicsDashboard()
  const sizesState = useEconomicsSizes({
    accountId: () => tableQueryState.accountId.value,
    dateFrom: () => tableQueryState.form.value.date_from,
    dateTo: () => tableQueryState.form.value.date_to,
  })

  const tableLoading = computed(() => itemsState.loading.value)
  const tableError = computed(() => itemsState.error.value)
  const tableEmpty = computed(() => !tableLoading.value && !tableError.value && itemsState.items.value.length === 0)

  const dashboardLoading = computed(() => dashboardState.loading.value)
  const dashboardError = computed(() => dashboardState.error.value)
  const dashboardEmpty = computed(
    () => !dashboardLoading.value && !dashboardError.value && dashboardState.dashboardMetrics.value.length === 0,
  )

  watch(
    () => tableQueryState.route.query,
    async () => {
      tableQueryState.syncStateFromQuery()
      dashboardQueryState.syncStateFromQuery({
        date_from: tableQueryState.form.value.date_from,
        date_to: tableQueryState.form.value.date_to,
        filters: tableQueryState.selectedFilters.value,
      })

      await Promise.all([
        itemsState.loadItems({
          accountId: tableQueryState.accountId.value,
          dateFrom: tableQueryState.form.value.date_from,
          dateTo: tableQueryState.form.value.date_to,
          filters: tableQueryState.selectedFilters.value,
          resetDetails: sizesState.resetSizesState,
        }),
        dashboardState.loadDashboard({
          accountId: dashboardQueryState.accountId.value,
          dateFrom: dashboardQueryState.form.value.date_from,
          dateTo: dashboardQueryState.form.value.date_to,
          filters: dashboardQueryState.selectedFilters.value,
        }),
      ])
    },
    { immediate: true },
  )

  return {
    accountId: tableQueryState.accountId,
    form: tableQueryState.form,
    selectedFilters: tableQueryState.selectedFilters,
    dashboardForm: dashboardQueryState.form,
    dashboardSelectedFilters: dashboardQueryState.selectedFilters,
    items: itemsState.items,
    totals: itemsState.totals,
    dashboard: dashboardState.dashboard,
    dashboardMetrics: dashboardState.dashboardMetrics,
    tableLoading,
    tableError,
    tableEmpty,
    dashboardLoading,
    dashboardError,
    dashboardEmpty,
    expandedItemKeys: sizesState.expandedItemKeys,
    sizesByItem: sizesState.sizesByItem,
    sizesLoadingByItem: sizesState.sizesLoadingByItem,
    sizesErrorByItem: sizesState.sizesErrorByItem,
    toggleItem: sizesState.toggleItem,
    handleFiltersApply: tableQueryState.handleFiltersApply,
    handleFiltersReset: tableQueryState.handleFiltersReset,
    handlePeriodApply: tableQueryState.handlePeriodApply,
    handleDashboardFiltersApply: dashboardQueryState.handleFiltersApply,
    handleDashboardFiltersReset: dashboardQueryState.handleFiltersReset,
    handleDashboardPeriodApply: dashboardQueryState.handlePeriodApply,
  }
}
