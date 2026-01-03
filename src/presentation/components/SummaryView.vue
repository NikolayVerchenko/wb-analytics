<template>
  <div class="space-y-6">
    <!-- Заголовок и фильтры -->
    <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Сводка</h2>
      <PeriodFilter />
    </div>

    <!-- Таблица -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                Товар
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Заказы
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Доставки
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Отказы
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Возвраты
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Продажи (шт.)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Реализация (шт.)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Выкупа
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Реализация до СПП
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Реализация после СПП
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма СПП
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                % СПП
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Перечисления
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Комиссия WB (₽)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Комиссии
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Логистика (₽)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Хранение (₽)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Реклама (₽)
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex items-center gap-1">
                  ДРР (пр.)
                  <div
                    class="tooltip-icon"
                    @mouseenter="showTooltip($event, 'Отношение рекламы к реализации до СПП.')"
                    @mouseleave="hideTooltip"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex items-center gap-1">
                  ДРР (зак.)
                  <div
                    class="tooltip-icon"
                    @mouseenter="showTooltip($event, 'Отношение рекламы к сумме заказов.')"
                    @mouseleave="hideTooltip"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex items-center gap-1">
                  ДРР (прогноз)
                  <div
                    class="tooltip-icon"
                    @mouseenter="showTooltip($event, 'Отношение рекламы к заказам с учетом коэффициента выкупа.')"
                    @mouseleave="hideTooltip"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex items-center gap-1">
                  Налог (₽)
                  <div
                    class="tooltip-icon"
                    @mouseenter="showTooltip($event, 'Налог рассчитывается от Реализации после СПП (фактически полученные деньги на счет).')"
                    @mouseleave="hideTooltip"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <!-- Итоговая строка -->
            <tr v-if="summary" class="bg-blue-50 font-semibold sticky top-[48px] z-10">
              <td class="px-4 py-3 text-sm font-bold text-gray-900">Итого</td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalOrdersCount }} / {{ formatCurrency(summary.totalOrdersSum) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalDeliveryCount }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalCancelCount }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalReturnsCount }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalSalesCount }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalNetSalesCount }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span :class="getBuyoutPercentClass(summary.totalBuyoutPercent)">
                  {{ formatBuyoutPercent(summary.totalBuyoutPercent) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalNetRevenue) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span :class="summary.totalRevenueAfterSpp < 0 ? 'text-red-600' : ''">
                  {{ formatCurrency(summary.totalRevenueAfterSpp) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span :class="summary.totalSppAmount < 0 ? 'text-gray-500' : ''">
                  {{ formatCurrency(summary.totalSppAmount) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalSppPercent.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalTransferAmount) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalCommissionAmount) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalCommissionPercent.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalLogistics) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalStorageCosts) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalAdvCosts) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalDrrSales.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalDrrOrders.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ summary.totalDrrOrdersForecast.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                {{ formatCurrency(summary.totalTaxes) }}
              </td>
            </tr>

            <!-- Строки артикулов -->
            <template v-for="product in report" :key="product.ni">
              <tr
                class="hover:bg-gray-50 cursor-pointer"
                @click="toggleProduct(product.ni)"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <button
                      class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                      @click.stop="toggleProduct(product.ni)"
                    >
                      <svg
                        v-if="expandedProducts.has(product.ni)"
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <img
                      v-if="product.img"
                      :src="product.img"
                      :alt="product.title"
                      class="w-12 h-12 object-cover rounded"
                      @error="handleImageError"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900">{{ product.ni }}</div>
                      <div class="text-sm text-gray-500 truncate">{{ product.title }}</div>
      </div>
    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.ordersCount }} / {{ formatCurrency(product.ordersSum) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.deliveryCount }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.cancelCount }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.returnsCount }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.salesCount }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.netSalesCount }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  <span :class="getBuyoutPercentClass(product.buyoutPercent)">
                    {{ formatBuyoutPercent(product.buyoutPercent) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.netRevenue) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  <span :class="product.revenueAfterSpp < 0 ? 'text-red-600' : ''">
                    {{ formatCurrency(product.revenueAfterSpp) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  <span :class="product.sppAmount < 0 ? 'text-gray-500' : ''">
                    {{ formatCurrency(product.sppAmount) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.sppPercent.toFixed(2) }}%
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.transferAmount) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.commissionAmount) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.commissionPercent.toFixed(2) }}%
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.logisticsCosts) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.storageCost) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.advCosts) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  <span :class="product.drrSales > 20 ? 'text-orange-600' : ''">
                    {{ product.drrSales.toFixed(2) }}%
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.drrOrders.toFixed(2) }}%
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ product.drrOrdersForecast.toFixed(2) }}%
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">
                  {{ formatCurrency(product.taxes) }}
                </td>
              </tr>

              <!-- Строки размеров (вложенные) -->
              <template v-if="expandedProducts.has(product.ni) && product.sizes.length > 0">
                <tr
                  v-for="size in product.sizes"
                  :key="`${product.ni}_${size.sz}`"
                  class="bg-gray-50 hover:bg-gray-100"
                >
                  <td class="px-4 py-2 pl-12">
                    <div class="text-sm text-gray-600">Размер: {{ size.sz }}</div>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    — / —
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.deliveryCount }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.cancelCount }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.returnsCount }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.salesCount }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.netSalesCount }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    <span :class="getBuyoutPercentClass(size.buyoutPercent)">
                      {{ formatBuyoutPercent(size.buyoutPercent) }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.netRevenue) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    <span :class="size.revenueAfterSpp < 0 ? 'text-red-600' : ''">
                      {{ formatCurrency(size.revenueAfterSpp) }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    <span :class="size.sppAmount < 0 ? 'text-gray-500' : ''">
                      {{ formatCurrency(size.sppAmount) }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.sppPercent.toFixed(2) }}%
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.transferAmount) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.commissionAmount) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ size.commissionPercent.toFixed(2) }}%
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.logisticsCosts) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.storageCost) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    —
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    —
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    —
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    —
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">
                    {{ formatCurrency(size.taxes) }}
                  </td>
                </tr>
              </template>
            </template>

            <!-- Пустое состояние -->
            <tr v-if="report.length === 0">
              <td colspan="22" class="px-4 py-8 text-center text-gray-500">
                {{ !store.filters.dateFrom || !store.filters.dateTo ? 'Выберите период' : 'Нет данных' }}
              </td>
            </tr>
          </tbody>
        </table>
    </div>
    </div>
  </div>

  <!-- Tooltip через Teleport -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tooltipVisible"
        ref="tooltipRef"
        class="fixed tooltip-popup"
        :style="{
          top: tooltipPosition.top + 'px',
          left: tooltipPosition.left + 'px',
          transform: 'translate(-50%, calc(-100% - 8px))',
        }"
      >
        {{ tooltipText }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import PeriodFilter from './PeriodFilter.vue'

const store = useAnalyticsStore()

// Состояние раскрытых артикулов
const expandedProducts = ref<Set<number>>(new Set())

// Получаем данные из store
const report = computed(() => store.aggregatedReport)
const summary = computed(() => store.totalSummary)

// Переключение раскрытия артикула
const toggleProduct = (ni: number) => {
  if (expandedProducts.value.has(ni)) {
    expandedProducts.value.delete(ni)
  } else {
    expandedProducts.value.add(ni)
  }
}

// Форматирование валюты
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatBuyoutPercent = (value: number): string => {
  return value.toFixed(1) + '%'
}

const getBuyoutPercentClass = (value: number): string => {
  if (value < 30) return 'text-red-600 font-semibold'
  if (value > 70) return 'text-green-600 font-semibold'
  return 'text-gray-700'
}

// Обработка ошибки загрузки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Tooltip состояние
const tooltipRef = ref<HTMLDivElement | null>(null)
const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipPosition = ref({ top: 0, left: 0 })
let tooltipTimeout: number | null = null

// Показать tooltip
const showTooltip = (event: MouseEvent, text: string) => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
  
  tooltipText.value = text
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  
  // Вычисляем позицию: над иконкой с небольшим смещением (8px)
  tooltipPosition.value = {
    top: rect.top - 8, // 8px offset
    left: rect.left + rect.width / 2
  }
  
  tooltipTimeout = window.setTimeout(() => {
    tooltipVisible.value = true
  }, 300)
}

// Скрыть tooltip
const hideTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
    tooltipTimeout = null
  }
  tooltipVisible.value = false
}

// Обновить позицию при скролле
const updateTooltipPosition = () => {
  if (tooltipVisible.value && tooltipRef.value) {
    // Позиция будет обновлена при следующем hover
  }
}

onMounted(() => {
  window.addEventListener('scroll', updateTooltipPosition, true)
  window.addEventListener('resize', updateTooltipPosition)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateTooltipPosition, true)
  window.removeEventListener('resize', updateTooltipPosition)
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
})
</script>

<style scoped>
.tooltip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
.tooltip-popup {
  z-index: 9999;
  background-color: rgba(31, 41, 55, 0.95);
  color: white;
  text-align: center;
  border-radius: 6px;
  padding: 8px 12px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: normal;
  pointer-events: none;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.tooltip-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(31, 41, 55, 0.95) transparent transparent transparent;
}
</style>
