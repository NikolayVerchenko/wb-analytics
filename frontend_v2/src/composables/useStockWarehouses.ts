import { ref } from 'vue'
import { getStockWarehouses } from '../api/stocks'
import type { StockItem, StockWarehouse } from '../types/stocks'

export function useStockWarehouses(params: {
  accountId: () => string
}) {
  const expandedItemKeys = ref<string[]>([])
  const warehousesByItem = ref<Record<string, StockWarehouse[]>>({})
  const warehousesLoadingByItem = ref<Record<string, boolean>>({})
  const warehousesErrorByItem = ref<Record<string, string>>({})

  function getItemKey(item: StockItem): string {
    return `${item.vendor_code || 'empty'}-${item.nm_id || 'empty'}-${item.tech_size || 'empty'}`
  }

  function canExpandItem(item: StockItem): boolean {
    return item.nm_id !== null && item.vendor_code !== null && item.tech_size !== null
  }

  async function loadWarehouses(item: StockItem) {
    if (!params.accountId() || item.nm_id == null || !item.vendor_code || !item.tech_size) {
      return
    }

    const itemKey = getItemKey(item)
    if (warehousesByItem.value[itemKey]) {
      return
    }

    warehousesLoadingByItem.value[itemKey] = true
    warehousesErrorByItem.value[itemKey] = ''

    try {
      warehousesByItem.value[itemKey] = await getStockWarehouses({
        account_id: params.accountId(),
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
        tech_size: item.tech_size,
      })
    } catch (err) {
      warehousesErrorByItem.value[itemKey] = err instanceof Error ? err.message : 'Не удалось загрузить склады.'
    } finally {
      warehousesLoadingByItem.value[itemKey] = false
    }
  }

  async function toggleItem(item: StockItem) {
    if (!canExpandItem(item)) {
      return
    }

    const itemKey = getItemKey(item)
    if (expandedItemKeys.value.includes(itemKey)) {
      expandedItemKeys.value = expandedItemKeys.value.filter((key) => key !== itemKey)
      return
    }

    expandedItemKeys.value = [...expandedItemKeys.value, itemKey]
    await loadWarehouses(item)
  }

  return {
    expandedItemKeys,
    warehousesByItem,
    warehousesLoadingByItem,
    warehousesErrorByItem,
    toggleItem,
  }
}
