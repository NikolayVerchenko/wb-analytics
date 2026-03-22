import { watch } from 'vue'
import { useEconomicsItems } from './useEconomicsItems'
import { useEconomicsQueryState } from './useEconomicsQueryState'
import { useEconomicsSizes } from './useEconomicsSizes'

export function useEconomicsPage() {
  const queryState = useEconomicsQueryState()
  const itemsState = useEconomicsItems()
  const sizesState = useEconomicsSizes({
    accountId: () => queryState.accountId.value,
    dateFrom: () => queryState.form.value.date_from,
    dateTo: () => queryState.form.value.date_to,
  })

  watch(
    () => queryState.route.query,
    async () => {
      queryState.syncStateFromQuery()
      await itemsState.loadItems({
        accountId: queryState.accountId.value,
        dateFrom: queryState.form.value.date_from,
        dateTo: queryState.form.value.date_to,
        filters: queryState.selectedFilters.value,
        resetDetails: sizesState.resetSizesState,
      })
    },
    { immediate: true },
  )

  return {
    accountId: queryState.accountId,
    form: queryState.form,
    selectedFilters: queryState.selectedFilters,
    items: itemsState.items,
    totals: itemsState.totals,
    loading: itemsState.loading,
    error: itemsState.error,
    expandedItemKeys: sizesState.expandedItemKeys,
    sizesByItem: sizesState.sizesByItem,
    sizesLoadingByItem: sizesState.sizesLoadingByItem,
    sizesErrorByItem: sizesState.sizesErrorByItem,
    toggleItem: sizesState.toggleItem,
    handleFiltersApply: queryState.handleFiltersApply,
    handleFiltersReset: queryState.handleFiltersReset,
    handlePeriodApply: queryState.handlePeriodApply,
  }
}
