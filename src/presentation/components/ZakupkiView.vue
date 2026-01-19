<template>
  <div class="min-h-screen bg-slate-50 pb-24">
    <!-- Document Header -->
    <PurchaseDocumentHeader
      :form-data="formData"
      :totals="totals"
      :purchase-total-r-u-b="purchaseTotalRUB"
      :can-save="canSave && !hasCriticalErrors"
      :is-editing="editingPurchaseId !== undefined"
      :is-loading="isLoading"
      @update:date="formData.date = $event"
      @update:orderNumber="formData.orderNumber = $event"
      @update:status="formData.status = $event"
      @toggle-advanced="showAdvanced = !showAdvanced"
      @save="savePurchase"
      @reset="resetForm"
    />

    <!-- Advanced Parameters Panel -->
    <PurchaseAdvancedPanel
      :exchange-rate="formData.exchangeRate"
      :buyer-commission-percent="formData.buyerCommissionPercent"
      :logistics-to-moscow="formData.logisticsToMoscow"
      :open="showAdvanced"
      @update:exchangeRate="formData.exchangeRate = $event"
      @update:buyerCommissionPercent="formData.buyerCommissionPercent = $event"
      @update:logisticsToMoscow="formData.logisticsToMoscow = $event"
    />
    
    <!-- Editor Section: Товары -->
    <div class="max-w-6xl mx-auto px-6 pt-4">
      <div class="bg-white rounded-lg shadow-sm border border-slate-200">
        <!-- Toolbar -->
        <div class="p-3 border-b border-slate-200">
          <ItemsToolbar 
            v-model:search-query="searchQuery"
            :hide-add-button="filteredGroups.length === 0"
            @add-product="showProductModal = true"
          />
        </div>

        <!-- Content -->
        <div class="p-3">
          <!-- Empty State -->
          <div v-if="filteredGroups.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-500">
            <svg
              class="w-10 h-10 text-slate-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p class="text-sm font-medium text-slate-900 mb-0.5">Нет товаров</p>
            <p class="text-xs text-slate-500 mb-3">Добавьте товары для начала работы</p>
            <button
              @click="showProductModal = true"
              class="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg
                class="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              + Добавить товары
            </button>
          </div>

          <!-- Grouped Items List -->
          <GroupedItemsList v-else>
            <GroupCard
              v-for="group in filteredGroups"
              :key="group.nmID"
              :group="group"
              :get-group-value="getGroupValue"
              :calculate-item-cost="calculateItemCost"
              :validation-state="validationState[group.nmID]"
              @remove-group="handleRemoveGroup"
              @update-group-field="handleUpdateGroupField"
              @apply-to-all="handleApplyToAll"
              @remove-item="handleRemoveItem"
              @update-variant-field="handleUpdateVariantField"
            />
          </GroupedItemsList>
        </div>
      </div>
    </div>

    <!-- Sticky Action Bar (только кнопка Назад) -->
    <StickyActionBar />
    
    <!-- Product Picker Modal -->
    <ProductPickerModal
      :isOpen="showProductModal"
      @close="showProductModal = false"
      @confirm="handleProductSelect"
    />

    <!-- History Section: Сохраненные закупки -->
    <div class="max-w-6xl mx-auto px-6 mt-8" v-if="purchases.length > 0">
      <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Сохраненные закупки</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Дата
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Номер заказа
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Статус
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Товаров
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="purchase in purchases" :key="purchase.id">
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ formatDate(purchase.date) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ purchase.orderNumber }}
              </td>
              <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 text-xs font-semibold rounded-full" :class="getStatusClass(purchase.status)">
                  {{ getStatusText(purchase.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ purchase.items.length }}
              </td>
              <td class="px-4 py-3 text-sm">
                <button
                  @click="handleEditPurchase(purchase.id!)"
                  class="text-blue-600 hover:text-blue-800 transition-colors mr-3"
                >
                  Редактировать
                </button>
                <button
                  @click="applyToSupply(purchase)"
                  class="text-blue-600 hover:text-blue-800 transition-colors mr-3"
                >
                  Применить к поставке
                </button>
                <button
                  @click="handleDeletePurchase(purchase.id!)"
                  class="text-red-600 hover:text-red-800 transition-colors"
                >
                  Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePurchases } from '../../composables/usePurchases'
import { usePurchaseUI } from '../../composables/usePurchaseUI'
import { ServiceFactory } from '../../core/factories/ServiceFactory'
import { toastService } from '../services/ToastService'
import { useRouter } from 'vue-router'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import type { IPurchase, IPurchaseItem, IProductCard } from '../../types/db'
import ProductPickerModal from './ProductPickerModal.vue'
import PurchaseDocumentHeader from './purchases/PurchaseDocumentHeader.vue'
import PurchaseAdvancedPanel from './purchases/PurchaseAdvancedPanel.vue'
import ItemsToolbar from './purchases/ItemsToolbar.vue'
import GroupedItemsList from './purchases/GroupedItemsList.vue'
import GroupCard from './purchases/GroupCard.vue'
import StickyActionBar from './purchases/StickyActionBar.vue'

const router = useRouter()
const store = useAnalyticsStore()

// Инициализация сервисов через фабрику
const purchaseService = ServiceFactory.createPurchaseService()

// Использование composable
const {
  form: formData,
  groupedProducts,
  purchases,
  totals,
  canSave,
  isLoading,
  editingPurchaseId,
  addItemsFromProduct,
  save: savePurchase,
  reset: resetForm,
  loadPurchases,
  loadPurchaseForEdit,
  deletePurchase,
  removeGroup: removeProductGroup,
  removeItem: removeItemFromForm,
  applyValueToGroup,
  getGroupValue,
  calculateItemCost,
  applyToSupply,
} = usePurchases(
  purchaseService,
  store.productCards,
  {
    onSuccess: (msg) => toastService.success(msg),
    onError: (msg) => toastService.error(msg),
    onNavigate: (path, query) => router.push({ path, query }),
  }
)

// UI composable для фильтрации и валидации
const {
  searchQuery,
  filteredGroups,
  validationState,
  hasCriticalErrors,
} = usePurchaseUI(formData, groupedProducts)

// Computed для итого в рублях через бизнес-логику
const purchaseTotalRUB = computed(() => {
  return purchaseService.calculator.calculatePurchaseTotalRUB(formData.value as IPurchase)
})

// Централизованные handlers для мутации formData
const handleUpdateGroupField = (nmID: number, field: keyof IPurchaseItem, value: number) => {
  console.log(`[ZakupkiView] handleUpdateGroupField: nmID = ${nmID}, field = ${field}, value = ${value}`)
  applyValueToGroup(nmID, field, value)
  console.log(`[ZakupkiView] handleUpdateGroupField: применено, текущие items:`, formData.value.items.filter(item => item.nmID === nmID).map(item => ({
    techSize: item.techSize,
    [field]: item[field]
  })))
}

const handleApplyToAll = (nmID: number, field: keyof IPurchaseItem, value: number) => {
  console.log(`[ZakupkiView] handleApplyToAll: nmID = ${nmID}, field = ${field}, value = ${value}`)
  applyValueToGroup(nmID, field, value)
  console.log(`[ZakupkiView] handleApplyToAll: применено, текущие items:`, formData.value.items.filter(item => item.nmID === nmID).map(item => ({
    techSize: item.techSize,
    [field]: item[field]
  })))
}

const handleUpdateVariantField = (nmID: number, techSize: string, field: 'quantity' | 'priceCNY', value: number) => {
  const item = formData.value.items.find(
    (item) => item.nmID === nmID && item.techSize === techSize
  )
  if (item) {
    if (field === 'quantity') {
      item.quantity = value
    } else if (field === 'priceCNY') {
      item.priceCNY = value
    }
  }
}

const handleRemoveItem = (nmID: number, techSize: string) => {
  removeItemFromForm(nmID, techSize)
}

const handleRemoveGroup = (nmID: number) => {
  removeProductGroup(nmID)
}

// UI-specific
const showProductModal = ref(false)
const showAdvanced = ref(false)

// Обработка выбора товаров из модалки
const handleProductSelect = (payload: Array<{ product: IProductCard; sizes: string[] }>) => {
  for (const { product, sizes } of payload) {
    // Передаём product как ProductSelection
    // ProductCardPrefillService сам найдёт нужные поля из productCards
  addItemsFromProduct(
    {
      ni: product.ni,
        title: product.title || '',
        sa: product.sa || '',
        weight: product.weight || null,
        img: product.img || null,
        color: undefined, // color не приходит из ProductCard
    },
    sizes
  )
  }
  showProductModal.value = false
}

// Редактирование закупки
const handleEditPurchase = async (id: number) => {
  await loadPurchaseForEdit(id)
}

// Удаление закупки с подтверждением
const handleDeletePurchase = async (id: number) => {
  if (!confirm('Вы уверены, что хотите удалить эту закупку?')) {
    return
  }
  await deletePurchase(id)
}

// Форматирование даты
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// Получение текста статуса
const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Ожидает',
    ordered: 'Заказано',
    shipped: 'Отправлено',
    received: 'Получено',
  }
  return statusMap[status] || status
}

// Получение класса статуса
const getStatusClass = (status: string): string => {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    ordered: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    received: 'bg-green-100 text-green-800',
  }
  return classMap[status] || 'bg-gray-100 text-gray-800'
}

// Загрузка при монтировании
onMounted(() => {
  loadPurchases()
})
</script>
