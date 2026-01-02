<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Финансовая аналитика</h2>
      <button
        @click="refresh"
        :disabled="isLoading"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg v-if="!isLoading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isLoading ? 'Загрузка...' : 'Обновить' }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary" class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
        <div class="text-sm font-medium text-gray-500 mb-1">Общая выручка</div>
        <div class="text-3xl font-bold text-gray-900">{{ formatCurrency(summary.totalRevenue) }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
        <div class="text-sm font-medium text-gray-500 mb-1">Себестоимость проданных</div>
        <div class="text-3xl font-bold text-orange-600">{{ formatCurrency(summary.totalCost) }}</div>
        <div class="text-xs text-gray-500 mt-1">
          {{ summary.salesWithCost }} / {{ summary.salesCount }} продаж с себестоимостью
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
        <div class="text-sm font-medium text-gray-500 mb-1">Чистая прибыль</div>
        <div class="text-3xl font-bold text-green-600">{{ formatCurrency(summary.netProfit) }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
        <div class="text-sm font-medium text-gray-500 mb-1">Средняя маржинальность</div>
        <div class="text-3xl font-bold text-purple-600">{{ summary.averageMargin.toFixed(1) }}%</div>
      </div>
    </div>

    <!-- Фильтры и переключатель вида -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">Фильтр по неделям</label>
          <select
            v-model="selectedWeek"
            @change="loadSalesData"
            class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все периоды</option>
            <option v-for="week in availableWeeks" :key="week" :value="week">
              {{ formatWeekLabel(week) }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Вид таблицы</label>
          <div class="flex gap-2">
            <button
              @click="viewMode = 'detailed'"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              Детально
            </button>
            <button
              @click="viewMode = 'grouped'"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'grouped'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              По артикулам
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Таблица продаж и прибыли (Детальный вид) -->
    <div v-if="viewMode === 'detailed' && salesWithProfit.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Дата</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Фото</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Артикул</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Цена продажи</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Комиссия WB</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Логистика WB</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Себестоимость (ед.)</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Общая себестоимость</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Валовая прибыль</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">ROI</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="sale in salesWithProfit"
              :key="sale.id"
              :class="{
                'bg-yellow-50': sale.coverageStatus === 'partial',
                'bg-red-50': sale.coverageStatus === 'empty' || !sale.hasCost
              }"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(sale.rr_dt) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                  <img
                    v-if="getProductPhoto(sale.nm_id)"
                    :src="getProductPhoto(sale.nm_id)"
                    :alt="sale.subject_name"
                    class="w-full h-full object-cover"
                    @error="handleImageError"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm">
                <div class="space-y-0.5">
                  <div class="font-bold text-gray-900">{{ sale.sa_name || `nmId: ${sale.nm_id}` }}</div>
                  <div class="text-xs text-gray-500">{{ sale.subject_name }}</div>
                  <div class="text-xs text-gray-400">Размер: {{ sale.ts_name || '—' }}</div>
                  <div v-if="sale.costWarning" class="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{{ sale.costWarning }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                {{ formatCurrency(sale.retail_amount) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                {{ sale.wbCommission !== undefined ? formatCurrency(sale.wbCommission) : '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                {{ sale.wbLogistics !== undefined ? formatCurrency(sale.wbLogistics) : '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right" :class="{
                'font-bold text-orange-600': sale.hasCost,
                'text-gray-400': !sale.hasCost
              }">
                {{ sale.unitCost !== undefined ? formatCurrency(sale.unitCost) : (sale.costWarning || '—') }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right" :class="{
                'font-bold text-orange-600': sale.hasCost,
                'text-gray-400': !sale.hasCost
              }">
                {{ sale.totalCost !== undefined ? formatCurrency(sale.totalCost) : '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold" :class="{
                'text-green-600': sale.grossProfit !== undefined && sale.grossProfit > 0,
                'text-red-600': sale.grossProfit !== undefined && sale.grossProfit < 0,
                'text-gray-400': sale.grossProfit === undefined
              }">
                {{ sale.grossProfit !== undefined ? formatCurrency(sale.grossProfit) : '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold" :class="{
                'text-green-600': sale.roi !== undefined && sale.roi > 0,
                'text-red-600': sale.roi !== undefined && sale.roi < 0,
                'text-gray-400': sale.roi === undefined
              }">
                {{ sale.roi !== undefined ? `${sale.roi.toFixed(1)}%` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Таблица продаж и прибыли (Группировка по артикулам) -->
    <div v-if="viewMode === 'grouped' && groupedSales.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Фото</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Артикул</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Кол-во шт.</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Средняя цена</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Выручка</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Себестоимость</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Валовая прибыль</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">ROI</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="group in groupedSales"
              :key="`${group.nm_id}_${group.ts_name || ''}`"
              :class="{
                'bg-yellow-50': group.coverageStatus === 'partial',
                'bg-red-50': group.coverageStatus === 'empty' || !group.hasCost
              }"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                  <img
                    v-if="group.photo"
                    :src="group.photo"
                    :alt="group.subject_name"
                    class="w-full h-full object-cover"
                    @error="handleImageError"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm">
                <div class="space-y-0.5">
                  <div class="font-bold text-gray-900">{{ group.sa_name }}</div>
                  <div class="text-xs text-gray-500">{{ group.subject_name }}</div>
                  <div v-if="group.ts_name" class="text-xs text-gray-400">Размер: {{ group.ts_name }}</div>
                  <div v-if="group.costWarning" class="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{{ group.costWarning }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                {{ group.totalQuantity }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                {{ formatCurrency(group.averagePrice) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                {{ formatCurrency(group.totalRevenue) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right" :class="{
                'font-bold text-orange-600': group.hasCost,
                'text-gray-400': !group.hasCost
              }">
                {{ group.totalCost > 0 ? formatCurrency(group.totalCost) : (group.costWarning || '—') }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold" :class="{
                'text-green-600': group.totalGrossProfit > 0,
                'text-red-600': group.totalGrossProfit < 0,
                'text-gray-400': !group.hasCost
              }">
                {{ group.hasCost ? formatCurrency(group.totalGrossProfit) : '—' }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold" :class="{
                'text-green-600': group.averageROI > 0,
                'text-red-600': group.averageROI < 0,
                'text-gray-400': !group.hasCost
              }">
                {{ group.hasCost ? `${group.averageROI.toFixed(1)}%` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-if="(viewMode === 'detailed' && salesWithProfit.length === 0) || (viewMode === 'grouped' && groupedSales.length === 0)" v-show="!isLoading" class="bg-white rounded-lg shadow p-8 text-center">
      <div class="max-w-md mx-auto">
        <div class="mb-6 flex justify-center">
          <div class="w-24 h-24 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center shadow-lg">
            <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">Нет данных о продажах</h3>
        <p class="text-gray-600">
          Синхронизируйте отчеты WB, чтобы увидеть финансовую аналитику.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { container } from '@core/di/container'
import type { SaleWithProfit, FinancialSummary, GroupedSaleByArticle } from '@application/services/FinancialService'
import { db } from '@infrastructure/db/database'
import type { Product } from '@core/domain/entities/Product'

// TODO: Восстановить после реализации FinancialService и ProductService в DIContainer
// const financialService = container.getFinancialService()
// const productService = container.getProductService()

const isLoading = ref(false)
const salesWithProfit = ref<SaleWithProfit[]>([])
const summary = ref<FinancialSummary | null>(null)
const selectedWeek = ref<string>('')
const availableWeeks = ref<string[]>([])
const products = ref<Product[]>([])
const viewMode = ref<'detailed' | 'grouped'>('detailed')

// Computed: группированные продажи (с мемоизацией)
const groupedSales = computed(() => {
  if (salesWithProfit.value.length === 0) return []
  
  // TODO: Восстановить после реализации FinancialService
  // const grouped = financialService.groupSalesByArticle(salesWithProfit.value, false)
  const grouped: GroupedSaleByArticle[] = []
  
  // Добавляем фото продуктов
  return grouped.map(group => {
    const product = productsByNmId.value.get(group.nm_id)
    return {
      ...group,
      photo: product?.photo,
    }
  })
})

// Computed: индекс продуктов по nmId
const productsByNmId = computed(() => {
  const index = new Map<number, Product>()
  products.value.forEach(product => {
    if (product.nmId) {
      index.set(product.nmId, product)
    }
  })
  return index
})

// Загрузка продаж с прибылью
const loadSalesData = async () => {
  isLoading.value = true
  try {
    let startDate: string | undefined
    let endDate: string | undefined

    if (selectedWeek.value) {
      // Парсим неделю (формат: YYYY-WW)
      const [year, week] = selectedWeek.value.split('-W')
      const date = new Date(parseInt(year), 0, 1)
      const daysToAdd = (parseInt(week) - 1) * 7
      date.setDate(date.getDate() + daysToAdd)
      startDate = date.toISOString().split('T')[0]
      
      const endDateObj = new Date(date)
      endDateObj.setDate(endDateObj.getDate() + 6)
      endDate = endDateObj.toISOString().split('T')[0]
    }

    // TODO: Восстановить после реализации FinancialService
    // salesWithProfit.value = await financialService.getSalesWithProfit(startDate, endDate)
    // summary.value = financialService.calculateFinancialSummary(salesWithProfit.value)
    salesWithProfit.value = []
    summary.value = null
  } catch (error) {
    console.error('Ошибка при загрузке продаж:', error)
    alert('Ошибка при загрузке данных о продажах')
  } finally {
    isLoading.value = false
  }
}

// Загрузка доступных недель
const loadAvailableWeeks = async () => {
  try {
    // Используем поле dt (короткий ключ) из таблицы sales
    const sales = await db.sales.orderBy('dt').toArray()
    const weeksSet = new Set<string>()
    
    sales.forEach(sale => {
      const date = new Date(sale.dt) // Используем dt вместо rr_dt
      const year = date.getFullYear()
      const week = getWeekNumber(date)
      weeksSet.add(`${year}-W${week}`)
    })
    
    availableWeeks.value = Array.from(weeksSet).sort().reverse()
  } catch (error) {
    console.error('Ошибка при загрузке недель:', error)
  }
}

// Получение номера недели
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Форматирование метки недели
const formatWeekLabel = (week: string): string => {
  const [year, weekNum] = week.split('-W')
  return `Неделя ${weekNum}, ${year}`
}

// Загрузка продуктов
const loadProducts = async () => {
  try {
    // TODO: Восстановить после реализации ProductService
    // products.value = await productService.getProducts()
    products.value = []
  } catch (error) {
    console.error('Ошибка при загрузке продуктов:', error)
  }
}

// Получение продукта по nmId
const getProductByNmId = (nmId: number): Product | undefined => {
  return productsByNmId.value.get(nmId)
}

// Получение фото продукта
const getProductPhoto = (nmId: number): string | undefined => {
  const product = getProductByNmId(nmId)
  return product?.photo
}

// Обработка ошибки загрузки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img.parentElement) {
    img.style.display = 'none'
    const placeholderDiv = document.createElement('div')
    placeholderDiv.className = 'w-full h-full flex items-center justify-center text-gray-400'
    placeholderDiv.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `
    img.parentElement.appendChild(placeholderDiv)
  }
}

// Форматирование валюты
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Форматирование даты
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Обновление данных
const refresh = async () => {
  await loadSalesData()
}

// Инициализация
onMounted(async () => {
  await loadProducts()
  await loadAvailableWeeks()
  await loadSalesData()
})
</script>

