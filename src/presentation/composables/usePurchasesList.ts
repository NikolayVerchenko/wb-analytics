import { ref, computed, watch, type Ref } from 'vue'
import type { PurchaseListRow, PurchasesQueryParams } from '@/types/purchases'
import { PurchasesQueryService } from '@/application/services/PurchasesQueryService'
import { PurchaseListMapper } from '@/application/services/PurchaseListMapper'
import type { IPurchase } from '@/types/db'

/**
 * Composable для управления состоянием списка закупок (листинг)
 */
export function usePurchasesList(purchases: Ref<IPurchase[]>) {
  const queryService = new PurchasesQueryService()
  const mapper = new PurchaseListMapper()

  // UI состояние
  const activeTab = ref<'all' | 'pending' | 'ordered' | 'shipped' | 'received'>('all')
  const searchQuery = ref('')
  const statusFilter = ref<string>('all')
  const sortBy = ref<'date' | 'totalRUB'>('date')
  const sortOrder = ref<'asc' | 'desc'>('desc')

  // Преобразуем IPurchase в PurchaseListRow
  const allRows = computed(() => mapper.toListRows(purchases.value))

  // Маппинг вкладок на статусы
  const getStatusForTab = (tab: string): string => {
    const tabMap: Record<string, string> = {
      all: 'all',
      pending: 'pending',
      ordered: 'ordered',
      shipped: 'shipped',
      received: 'received',
    }
    return tabMap[tab] || 'all'
  }

  // Автоматически обновляем фильтр статуса при смене вкладки
  watch(activeTab, (newTab) => {
    statusFilter.value = getStatusForTab(newTab)
  }, { immediate: true })

  // Параметры запроса
  const queryParams = computed<PurchasesQueryParams>(() => ({
    search: searchQuery.value || undefined,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }))

  // Отфильтрованные и отсортированные строки
  const filteredRows = computed(() => {
    return queryService.query(allRows.value, queryParams.value)
  })

  return {
    activeTab,
    searchQuery,
    statusFilter,
    sortBy,
    sortOrder,
    filteredRows,
    allRows,
  }
}
