<template>
  <div class="min-h-screen bg-slate-50 pb-8">
    <div class="max-w-7xl mx-auto px-6 py-6">
      <!-- Header -->
      <PurchasesHeader />

      <!-- Tabs -->
      <PurchasesTabs
        :active-tab="activeTab"
        @tab-change="activeTab = $event"
      />

      <!-- Toolbar -->
      <PurchasesToolbar
        v-model:search-query="searchQuery"
        v-model:status-filter="statusFilter"
        @toggle-columns="showColumnsModal = true"
      />

      <!-- Table or Empty State -->
      <PurchasesTable
        v-if="filteredRows.length > 0"
        :rows="filteredRows"
        @edit="handleEdit"
        @delete="handleDelete"
      />
      <PurchasesEmptyState v-else />

      <!-- Columns Modal (TODO: будет реализовано позже) -->
      <!-- <PurchasesColumnsModal v-if="showColumnsModal" @close="showColumnsModal = false" /> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePurchasesList } from '@/presentation/composables/usePurchasesList'
import { ServiceFactory } from '@/core/factories/ServiceFactory'
import { toastService } from '../../services/ToastService'
import PurchasesHeader from './listing/PurchasesHeader.vue'
import PurchasesTabs from './listing/PurchasesTabs.vue'
import PurchasesToolbar from './listing/PurchasesToolbar.vue'
import PurchasesTable from './listing/PurchasesTable.vue'
import PurchasesEmptyState from './listing/PurchasesEmptyState.vue'
import type { IPurchase } from '@/types/db'

// Загрузка данных
const purchases = ref<IPurchase[]>([])
const purchaseService = ServiceFactory.createPurchaseService()

// UI состояние
const showColumnsModal = ref(false)

// Загрузка закупок
const loadPurchases = async () => {
  try {
    purchases.value = await purchaseService.loadPurchases()
  } catch (error) {
    console.error('[PurchasesListView] Error loading purchases:', error)
    toastService.error('Ошибка загрузки закупок')
  }
}

// Использование composable для фильтрации/сортировки
const {
  activeTab,
  searchQuery,
  statusFilter,
  filteredRows,
} = usePurchasesList(purchases)

// Обработчики
const handleEdit = (id: number) => {
  // Навигация происходит в компоненте строки
}

const handleDelete = async (id: number) => {
  if (!confirm('Вы уверены, что хотите удалить эту закупку?')) {
    return
  }
  
  try {
    await purchaseService.deletePurchase(id)
    toastService.success('Закупка удалена')
    await loadPurchases()
  } catch (error) {
    console.error('[PurchasesListView] Error deleting purchase:', error)
    toastService.error('Ошибка удаления закупки')
  }
}

onMounted(() => {
  loadPurchases()
})
</script>
