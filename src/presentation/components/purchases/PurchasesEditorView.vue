<template>
  <div class="min-h-screen bg-slate-50 pb-24">
    <!-- Document Header -->
    <PurchaseDocumentHeader
      :form-data="formData"
      :totals="totals"
      :purchase-total-r-u-b="purchaseTotalRUB"
      :can-save="canSave && !hasCriticalErrors"
      :is-editing="isEditing"
      :is-loading="isLoading"
      @update:date="formData.date = $event"
      @update:orderNumber="formData.orderNumber = $event"
      @update:status="formData.status = $event"
      @save="savePurchase"
      @reset="resetForm"
    />

    <!-- Advanced Parameters Panel -->
    <PurchaseAdvancedPanel
      :exchange-rate="formData.exchangeRate"
      :buyer-commission-percent="formData.buyerCommissionPercent"
      :logistics-to-moscow="formData.logisticsToMoscow"
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
          <div v-if="filteredGroups.length === 0" class="flex flex-col items-center justify-center py-4 text-slate-500">
            <svg
              class="w-5 h-5 text-slate-400 mb-1"
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
            <p class="text-xs font-medium text-slate-900 mb-0.5">Нет товаров</p>
            <p class="text-xs text-slate-500 mb-2">Добавьте товары для начала работы</p>
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
              Добавить товары
            </button>
          </div>

          <!-- Grouped Items List -->
          <GroupedItemsList v-if="filteredGroups.length > 0" :key="`groups-${filteredGroups.length}-${formData.items.length}`">
            <GroupCard
              v-for="group in filteredGroups"
              :key="`group-${group.nmID}-${group.items.length}`"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePurchases } from '@/composables/usePurchases'
import { usePurchaseUI } from '@/composables/usePurchaseUI'
import { ServiceFactory } from '@/core/factories/ServiceFactory'
import { toastService } from '../../services/ToastService'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { IPurchase, IPurchaseItem, IProductCard } from '@/types/db'
import ProductPickerModal from '../ProductPickerModal.vue'
import PurchaseDocumentHeader from './PurchaseDocumentHeader.vue'
import PurchaseAdvancedPanel from './PurchaseAdvancedPanel.vue'
import ItemsToolbar from './ItemsToolbar.vue'
import GroupedItemsList from './GroupedItemsList.vue'
import GroupCard from './GroupCard.vue'
import StickyActionBar from './StickyActionBar.vue'

const route = useRoute()
const router = useRouter()
const store = useAnalyticsStore()

// Проверяем, редактируем ли существующую закупку
const purchaseId = computed(() => {
  const id = route.params.id
  return id && id !== 'new' ? Number(id) : undefined
})

const isEditing = computed(() => purchaseId.value !== undefined)

// Инициализация сервисов через фабрику
const purchaseService = ServiceFactory.createPurchaseService()

// Использование composable
const {
  form: formData,
  groupedProducts,
  totals,
  canSave,
  isLoading,
  editingPurchaseId,
  addItemsFromProduct,
  save: savePurchase,
  reset: resetForm,
  loadPurchases,
  loadPurchaseForEdit,
  removeGroup: removeProductGroup,
  removeItem: removeItemFromForm,
  applyValueToGroup,
  getGroupValue,
  calculateItemCost,
} = usePurchases(
  purchaseService,
  store.productCards,
  {
    onSuccess: (msg) => {
      toastService.success(msg)
      // После сохранения перенаправляем в список
      router.push('/purchases')
    },
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
  applyValueToGroup(nmID, field, value)
}

const handleApplyToAll = (nmID: number, field: keyof IPurchaseItem, value: number) => {
  applyValueToGroup(nmID, field, value)
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

// Обработка выбора товаров из модалки
  const handleProductSelect = (payload: Array<{ product: IProductCard; sizes: string[] }>) => {
    let totalSizes = 0
    for (const { product, sizes } of payload) {
      totalSizes += sizes.length
      addItemsFromProduct(
        {
          ni: product.ni,
          title: product.title || '',
          sa: product.sa || '',
          weight: product.weight || null,
          img: product.img || null,
          color: undefined,
        },
        sizes
      )
    }
    
    showProductModal.value = false
    
    // Показываем уведомление о добавлении товаров
    if (totalSizes > 0) {
      toastService.success(`Добавлено ${totalSizes} размеров товара`)
    }
  }

// Флаг для отслеживания, была ли выполнена первичная загрузка
const hasInitialized = ref(false)

// Загрузка закупки для редактирования
const loadPurchaseData = async () => {
  try {
    if (purchaseId.value) {
      // Редактирование существующей закупки
      await loadPurchaseForEdit(purchaseId.value)
      hasInitialized.value = true
    } else {
      // Новый заказ - загружаем список закупок для расчета номера только при первом запуске
      if (!hasInitialized.value) {
        await loadPurchases()
        // Сбрасываем форму только если она пустая, чтобы не потерять уже добавленные товары
        if (formData.value.items.length === 0) {
          resetForm()
        }
        hasInitialized.value = true
      }
    }
  } catch (error) {
    console.error('[PurchasesEditorView] Error loading purchase data:', error)
    toastService.error('Ошибка загрузки данных закупки')
  }
}

// Загружаем данные при монтировании или изменении ID
onMounted(() => {
  loadPurchaseData()
})

watch(purchaseId, (newId, oldId) => {
  if (newId !== oldId) {
    // Сбрасываем флаг инициализации при изменении ID
    hasInitialized.value = false
    loadPurchaseData()
  }
}, { immediate: false })

</script>
