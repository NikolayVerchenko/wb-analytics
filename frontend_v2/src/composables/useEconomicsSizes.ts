import { ref } from 'vue'
import { getPeriodSizes } from '../api/economics'
import type { EconomicsItem, EconomicsSizeItem } from '../types/economics'

export function useEconomicsSizes(params: {
  accountId: () => string
  dateFrom: () => string
  dateTo: () => string
}) {
  const expandedItemKeys = ref<string[]>([])
  const sizesByItem = ref<Record<string, EconomicsSizeItem[]>>({})
  const sizesLoadingByItem = ref<Record<string, boolean>>({})
  const sizesErrorByItem = ref<Record<string, string>>({})

  function getItemKey(item: EconomicsItem): string {
    return `${item.vendor_code || 'empty'}-${item.nm_id || 'empty'}`
  }

  function canExpandItem(item: EconomicsItem): boolean {
    return item.nm_id !== null && item.vendor_code !== null && item.vendor_code.length > 0
  }

  function resetSizesState() {
    expandedItemKeys.value = []
    sizesByItem.value = {}
    sizesLoadingByItem.value = {}
    sizesErrorByItem.value = {}
  }

  async function loadSizes(item: EconomicsItem) {
    if (!params.accountId() || item.nm_id === null || !item.vendor_code) {
      return
    }

    const itemKey = getItemKey(item)
    if (sizesByItem.value[itemKey]) {
      return
    }

    sizesLoadingByItem.value[itemKey] = true
    sizesErrorByItem.value[itemKey] = ''

    try {
      const sizes = await getPeriodSizes({
        account_id: params.accountId(),
        date_from: params.dateFrom(),
        date_to: params.dateTo(),
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
      })

      sizesByItem.value[itemKey] = sizes
    } catch (err) {
      sizesErrorByItem.value[itemKey] =
        err instanceof Error ? err.message : 'Не удалось загрузить размеры.'
    } finally {
      sizesLoadingByItem.value[itemKey] = false
    }
  }

  async function toggleItem(item: EconomicsItem) {
    if (!canExpandItem(item)) {
      return
    }

    const itemKey = getItemKey(item)
    if (expandedItemKeys.value.includes(itemKey)) {
      expandedItemKeys.value = expandedItemKeys.value.filter((key) => key !== itemKey)
      return
    }

    expandedItemKeys.value = [...expandedItemKeys.value, itemKey]
    await loadSizes(item)
  }

  return {
    expandedItemKeys,
    sizesByItem,
    sizesLoadingByItem,
    sizesErrorByItem,
    resetSizesState,
    toggleItem,
  }
}
