<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h2 class="text-2xl font-bold text-gray-900">Сводка</h2>
        <!-- Индикатор типа данных за период -->
        <div 
          v-if="dataTypeIndicator"
          class="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg text-sm"
          :title="dataTypeIndicator.tooltip"
        >
          <span class="text-lg">{{ dataTypeIndicator.icon }}</span>
          <span class="text-gray-700">{{ dataTypeIndicator.label }}</span>
        </div>
      </div>
      <button
        @click="refresh"
        :disabled="isLoading"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw :class="{ 'animate-spin': isLoading }" class="w-4 h-4" />
        Обновить
      </button>
    </div>

    <!-- Фильтры -->
    <div class="bg-white px-4 py-3 rounded-lg shadow">
      <h3 class="text-sm font-semibold text-gray-900 mb-2">Фильтры</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <!-- Период -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            Период
          </label>
          <DateRangePicker />
        </div>

        <!-- Категории -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            Категории
          </label>
          <CategoryFilter />
        </div>

        <!-- Артикулы продавца -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">
            Артикулы
          </label>
          <VendorCodeFilter />
        </div>
      </div>
    </div>

    <!-- Состояние загрузки -->
    <div v-if="isLoading" class="bg-white p-6 rounded-lg shadow">
      <div class="flex items-center justify-center py-12">
        <RefreshCw class="w-8 h-8 text-blue-600 animate-spin" />
        <span class="ml-3 text-gray-600">Загрузка данных...</span>
      </div>
    </div>

    <!-- Сообщение об отсутствии данных -->
    <div
      v-else-if="!summaryData || summaryData.length === 0"
      class="bg-white p-6 rounded-lg shadow text-center"
    >
      <p class="text-gray-600">Нет данных для отображения</p>
    </div>

    <!-- Таблица -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <PivotTable :data="summaryData" :total="totalRow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { container } from '@core/di/container'
import { useWbStore } from '../stores/wbStore'
import { useFilterStore } from '../stores/filterStore'
import type { SummaryFilters, SummaryRow } from '@application/services/SummaryService'
import DateRangePicker from './DateRangePicker.vue'
import CategoryFilter from './CategoryFilter.vue'
import VendorCodeFilter from './VendorCodeFilter.vue'
import PivotTable from './PivotTable.vue'

const store = useWbStore()
const filterStore = useFilterStore()
const isLoading = ref(false)
const summaryData = ref<SummaryRow[]>([])
const availableCategories = ref<string[]>([])

// Индикатор типа данных (Daily vs Final)
const dataTypeIndicator = ref<{
  icon: string
  label: string
  tooltip: string
} | null>(null)

const filters = ref<SummaryFilters>({
  dateFrom: undefined,
  dateTo: undefined,
  categories: undefined,
  vendorCodes: undefined,
})

// Использование сервиса из контейнера
const summaryService = container.getSummaryService()

// Вычисляем итоговую строку
const totalRow = computed(() => {
  if (!summaryData.value || summaryData.value.length === 0) {
    return null
  }
  return summaryService.calculateTotal(summaryData.value)
})

// Следим за изменением диапазона дат в store
watch(() => filterStore.currentDateRange, async (newRange) => {
  if (newRange) {
    filters.value.dateFrom = newRange.start
    filters.value.dateTo = newRange.end
    await loadData()
  }
}, { deep: true })

// Следим за изменением выбранных категорий в store
watch(() => filterStore.selectedCategories, (newCategories) => {
  filters.value.categories = newCategories
  loadData()
}, { deep: true })

// Следим за изменением выбранных артикулов в store
watch(() => filterStore.selectedVendorCodes, (newVendorCodes) => {
  filters.value.vendorCodes = newVendorCodes
  loadData()
}, { deep: true })

const loadData = async () => {
  isLoading.value = true
  try {
    // Применяем фильтры из store (dateRange и selectedCategories) и локальные фильтры
    const filtersToApply: SummaryFilters = {
      ...filters.value,
    }
    
    // Если есть диапазон дат из store, используем его
    if (filterStore.currentDateRange) {
      filtersToApply.dateFrom = filterStore.currentDateRange.start
      filtersToApply.dateTo = filterStore.currentDateRange.end
    }
    
    // Если есть выбранные категории из store, используем их
    if (filterStore.selectedCategories) {
      filtersToApply.categories = filterStore.selectedCategories
    }
    
    // Если есть выбранные артикулы из store, используем их
    if (filterStore.selectedVendorCodes) {
      filtersToApply.vendorCodes = filterStore.selectedVendorCodes
    }
    
    summaryData.value = await summaryService.getSummaryData(filtersToApply)
    
    // Загружаем категории, если еще не загружены (устаревшее, но оставляем для совместимости)
    if (availableCategories.value.length === 0) {
      availableCategories.value = await summaryService.getCategories()
    }
    
    // Обновляем индикатор типа данных через сервис
    dataTypeIndicator.value = await summaryService.getDataTypeIndicator(filtersToApply.dateFrom, filtersToApply.dateTo)
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
  } finally {
    isLoading.value = false
  }
}

const refresh = async () => {
  await loadData()
}

// Реактивное обновление данных при загрузке background синхронизации
// Обновляем каждые 10 секунд, если идет background синхронизация
let backgroundRefreshInterval: number | null = null
watch(() => store.isBackgroundSyncing, (isRunning) => {
  if (isRunning) {
    // Запускаем периодическое обновление данных каждые 10 секунд
    backgroundRefreshInterval = window.setInterval(() => {
      console.log('Обновление данных сводки (background синхронизация активна)...')
      loadData()
    }, 10000)
  } else {
    // Останавливаем обновление когда background синхронизация завершена
    if (backgroundRefreshInterval) {
      clearInterval(backgroundRefreshInterval)
      backgroundRefreshInterval = null
      // Финальное обновление при завершении
      loadData()
    }
  }
})

onMounted(() => {
  loadData()
})

onBeforeUnmount(() => {
  // Очищаем интервал при размонтировании компонента
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval)
    backgroundRefreshInterval = null
  }
})
</script>
