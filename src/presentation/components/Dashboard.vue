<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">Дашборд</h2>
        <button
          @click="refresh"
          :disabled="isLoading"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw :class="{ 'animate-spin': isLoading }" class="w-4 h-4" />
          Обновить
        </button>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          class="app-btn-sm"
          @click="openFilters"
        >
          <svg class="h-3.5 w-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10m-7 6h4" />
          </svg>
          Фильтры
          <span
            v-if="activeFiltersCount > 0"
            class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
          >
            {{ activeFiltersCount }}
          </span>
        </button>
        <PeriodFilter
          v-model:dateFrom="dashboardDateFrom"
          v-model:dateTo="dashboardDateTo"
        />
      </div>
    </div>

    <!-- Состояние загрузки -->
    <div v-if="isLoading" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div v-for="i in 4" :key="i" class="bg-white p-6 rounded-lg shadow animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div class="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div class="bg-white p-6 rounded-lg shadow animate-pulse">
        <div class="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>

    <!-- Сообщение об отсутствии данных -->
    <div
      v-else-if="!dashboardData || dashboardData.weeks.length === 0"
      class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center"
    >
      <AlertCircle class="w-12 h-12 text-yellow-600 mx-auto mb-4" />
      <p class="text-lg font-semibold text-yellow-900 mb-2">
        Данные отсутствуют
      </p>
      <p class="text-yellow-700">
        Сначала запустите синхронизацию в настройках
      </p>
    </div>

    <!-- Основной контент -->
    <div v-else class="space-y-6">
      <!-- Карточки с метриками -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Заказы"
          :value="formatOrders(dashboardData.totals.ordersSum, dashboardData.totals.ordersCount)"
          icon="Wallet"
          color="purple"
          :trend="dashboardData.deltas.ordersSum"
          :delta="dashboardData.deltaText.ordersSum"
        />
        <MetricCard
          title="Реализация до СПП"
          :value="formatSales(dashboardData.totals.salesBeforeSpp, dashboardData.totals.netSalesCount)"
          icon="TrendingUp"
          color="blue"
          :trend="dashboardData.deltas.salesBeforeSpp"
          :delta="dashboardData.deltaText.salesBeforeSpp"
        />
        <MetricCard
          title="Реализация после СПП"
          :value="formatCurrency(dashboardData.totals.salesAfterSpp)"
          icon="Truck"
          color="green"
          :trend="dashboardData.deltas.salesAfterSpp"
          :delta="dashboardData.deltaText.salesAfterSpp"
        />
        <MetricCard
          title="СПП"
          :value="formatCommission(dashboardData.totals.sppAmount, dashboardData.totals.sppPercent)"
          icon="TrendingDown"
          color="purple"
          :trend="dashboardData.deltas.sppPercent"
          :delta="dashboardData.deltaText.sppPercent"
        />
        <MetricCard
          title="К перечислению"
          :value="formatCurrency(dashboardData.totals.netPay)"
          icon="Wallet"
          color="green"
          :trend="dashboardData.deltas.netPay"
          :delta="dashboardData.deltaText.netPay"
        />
        <MetricCard
          title="Комиссия"
          :value="formatCommission(dashboardData.totals.commissionAmount, dashboardData.totals.commissionPercent)"
          icon="TrendingDown"
          color="red"
          :trend="dashboardData.deltas.commissionAmount"
          :delta="dashboardData.deltaText.commissionAmount"
        />
        <MetricCard
          title="Логистика"
          :value="formatCurrency(dashboardData.totals.logistics)"
          icon="Truck"
          color="purple"
          :trend="dashboardData.deltas.logistics * -1"
          :delta="dashboardData.deltaText.logistics"
        />
        <MetricCard
          title="Хранение"
          :value="formatCurrency(dashboardData.totals.storageCosts)"
          icon="Wallet"
          color="purple"
          :trend="dashboardData.deltas.storageCosts * -1"
          :delta="dashboardData.deltaText.storageCosts"
        />
        <MetricCard
          title="Реклама"
          :value="formatCurrency(dashboardData.totals.advCosts)"
          icon="TrendingDown"
          color="blue"
          :trend="dashboardData.deltas.advCosts * -1"
          :delta="dashboardData.deltaText.advCosts"
        />
        <MetricCard
          title="Себестоимость"
          :value="formatWithPercent(dashboardData.totals.unitCosts, dashboardData.totals.roiPercent, 'ROI')"
          icon="Wallet"
          color="purple"
          :trend="dashboardData.deltas.unitCosts"
          :delta="dashboardData.deltaText.unitCosts"
        />
        <MetricCard
          title="Прибыль"
          :value="formatWithPercent(dashboardData.totals.profit, dashboardData.totals.marginPercent, 'Маржа')"
          icon="TrendingUp"
          color="green"
          :trend="dashboardData.deltas.profit"
          :delta="dashboardData.deltaText.profit"
        />
        <MetricCard
          title="Возвраты"
          :value="formatCurrency(dashboardData.totals.totalReturns)"
          icon="TrendingDown"
          color="red"
          :trend="dashboardData.deltas.totalReturns"
          :delta="dashboardData.deltaText.totalReturns"
        />
      </div>

      <!-- График -->
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold">Динамика по дням</h3>
          <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span class="flex items-center gap-2">
              <span class="inline-block h-0.5 w-6 bg-gray-700"></span>
              Текущий период
            </span>
            <span class="flex items-center gap-2">
              <span class="inline-block h-0.5 w-6 border-t-2 border-dashed border-gray-500"></span>
              Предыдущий период
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 mb-4 text-xs text-gray-700">
          <span class="text-gray-500">Метрики:</span>
          <label
            v-for="metric in metricOptions"
            :key="metric.id"
            class="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1"
          >
            <input
              v-model="selectedMetrics"
              type="checkbox"
              :value="metric.id"
              class="h-3.5 w-3.5"
            />
            <span class="inline-flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: metric.color }"></span>
              {{ metric.label }}
            </span>
          </label>
        </div>
        <div class="h-72">
          <LineChart :data="chartData" />
        </div>
      </div>

      <!-- Таблица -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold">Детальная аналитика по неделям</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Период
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Неделя
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Продажи
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Продажа до СПП
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Возвраты
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Логистика
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  К перечислению
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="week in dashboardData.weeks" :key="week.weekId" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ week.period }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ week.weekId }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {{ formatCurrency(week.totalSales) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {{ formatCurrency(week.salesBeforeSpp) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                  {{ formatCurrency(week.totalReturns) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {{ formatCurrency(week.logistics) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                  {{ formatCurrency(week.netPay) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

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
        v-if="isFiltersOpen"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-6"
        @click.self="closeFilters"
      >
        <div class="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
          <div class="flex items-center justify-between border-b border-gray-200 pb-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10m-7 6h4" />
              </svg>
              Фильтры
              <span
                v-if="activeFiltersCount > 0"
                class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
              >
                {{ activeFiltersCount }}
              </span>
            </div>
            <button class="text-xs text-gray-500 hover:text-gray-700" type="button" @click="closeFilters">
              Закрыть
            </button>
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
            <div class="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'subject' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'subject'"
              >
                Предмет
                <span v-if="draftSubjects.length" class="text-xs text-blue-600">{{ draftSubjects.length }}</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'vendorCode' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'vendorCode'"
              >
                Артикул продавца
                <span v-if="draftVendorCodes.length" class="text-xs text-blue-600">{{ draftVendorCodes.length }}</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'brand' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'brand'"
              >
                Бренд
                <span v-if="draftBrands.length || draftIncludeNoBrand" class="text-xs text-blue-600">
                  {{ draftBrands.length + (draftIncludeNoBrand ? 1 : 0) }}
                </span>
              </button>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs"
                :class="activeFilterTab === 'article' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
                @click="activeFilterTab = 'article'"
              >
                Артикул
                <span v-if="draftSearchQuery" class="text-xs text-blue-600">1</span>
              </button>
            </div>

            <div class="rounded-lg border border-gray-200 p-3">
              <div v-if="activeFilterTab === 'subject'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по предметам"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="subject in filteredSubjectOptions"
                    :key="subject.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftSubjects.includes(subject.code)"
                      @change="toggleDraftSubject(subject.code)"
                    />
                    <span class="leading-tight">{{ subject.code }}</span>
                  </label>
                  <div v-if="filteredSubjectOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else-if="activeFilterTab === 'vendorCode'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по артикулам продавца"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="vendor in filteredVendorOptions"
                    :key="vendor.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftVendorCodes.includes(vendor.code)"
                      @change="toggleDraftVendorCode(vendor.code)"
                    />
                    <span class="leading-tight">
                      {{ vendor.code }}
                      <span v-if="vendor.title" class="block text-[10px] text-gray-500">{{ vendor.title }}</span>
                    </span>
                  </label>
                  <div v-if="filteredVendorOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else-if="activeFilterTab === 'brand'">
                <div class="relative mb-3">
                  <input
                    v-model="filterSearch"
                    type="text"
                    placeholder="Поиск по брендам"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.6-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <label class="mb-2 flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    class="mt-0.5"
                    :checked="draftIncludeNoBrand"
                    @change="draftIncludeNoBrand = !draftIncludeNoBrand"
                  />
                  Без бренда
                </label>
                <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs text-gray-700">
                  <label
                    v-for="brand in filteredBrandOptions"
                    :key="brand.code"
                    class="flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5"
                      :checked="draftBrands.includes(brand.code)"
                      @change="toggleDraftBrand(brand.code)"
                    />
                    <span class="leading-tight">{{ brand.code }}</span>
                  </label>
                  <div v-if="filteredBrandOptions.length === 0" class="text-xs text-gray-400">
                    Нет совпадений
                  </div>
                </div>
              </div>

              <div v-else>
                <label class="block text-xs font-medium text-gray-700">Поиск по артикулу</label>
                <input
                  v-model="draftSearchQuery"
                  type="text"
                  placeholder="Артикул или название"
                  class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-2 text-[11px] text-gray-500">
                  Фильтрует по названию и артикулу в таблице.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              @click="resetFilters"
            >
              Сбросить
            </button>
            <button
              type="button"
              class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              @click="applyFilters"
            >
              Применить
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw, AlertCircle } from 'lucide-vue-next'
import { useDashboardFilter } from '../composables/useDashboardFilter'
import { filterProducts } from '../composables/useProductFilter'
import { useAnalyticsStore } from '../../stores/analyticsStore'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '../stores/wbStore'
import LineChart from './LineChart.vue'
import MetricCard from './MetricCard.vue'
import PeriodFilter from './PeriodFilter.vue'
import type { ProductAggregate } from '../../types/analytics'
import { ReportTotalsCalculator } from '../../application/services/ReportTotalsCalculator'
import { addDays } from '../../application/sync/date'

const store = useAnalyticsStore()
// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
// const store = {
//   isSyncing: false,
//   isBackgroundSyncing: false,
// }
// TODO: Восстановить после реализации wbStore
// let backgroundRefreshInterval: number | null = null

type MetricId =
  | 'sales'
  | 'returns'
  | 'ordersSum'
  | 'ordersCount'
  | 'buyoutSum'
  | 'buyoutCount'
  | 'cartCount'
  | 'openCount'

type MetricUnit = 'currency' | 'count'

type MetricOption = {
  id: MetricId
  label: string
  color: string
  unit: MetricUnit
}

const metricOptions: MetricOption[] = [
  { id: 'sales', label: 'Продажи', color: 'rgb(59, 130, 246)', unit: 'currency' },
  { id: 'returns', label: 'Возвраты', color: 'rgb(239, 68, 68)', unit: 'currency' },
  { id: 'ordersSum', label: 'Заказы (сумма)', color: 'rgb(16, 185, 129)', unit: 'currency' },
  { id: 'ordersCount', label: 'Заказы (шт)', color: 'rgb(99, 102, 241)', unit: 'count' },
  { id: 'buyoutSum', label: 'Выкупы (сумма)', color: 'rgb(245, 158, 11)', unit: 'currency' },
  { id: 'buyoutCount', label: 'Выкупы (шт)', color: 'rgb(14, 116, 144)', unit: 'count' },
  { id: 'cartCount', label: 'Корзина (шт)', color: 'rgb(236, 72, 153)', unit: 'count' },
  { id: 'openCount', label: 'Переходы', color: 'rgb(75, 85, 99)', unit: 'count' },
]

const selectedMetrics = ref<MetricId[]>(['sales', 'returns'])

const buildDateRange = (from: string, to: string): string[] => {
  const dates: string[] = []
  let cursor = from
  while (cursor <= to) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

const formatDayLabel = (iso: string): string => {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}`
}

const sumByDate = <T>(
  records: T[],
  from: string,
  to: string,
  allowedNmIds: Set<number>,
  getDate: (record: T) => string,
  getValue: (record: T) => number,
  getNmId?: (record: T) => number | undefined
): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const record of records) {
    const date = getDate(record)
    if (date < from || date > to) continue
    if (getNmId) {
      const nmId = getNmId(record)
      if (nmId !== undefined && !allowedNmIds.has(nmId)) continue
    }
    const value = getValue(record)
    if (!Number.isFinite(value)) continue
    totals.set(date, (totals.get(date) || 0) + value)
  }
  return totals
}

const chartData = computed(() => {
  if (!dashboardDateFrom.value || !dashboardDateTo.value) {
    return { labels: [], datasets: [] }
  }

  const currentRange = buildDateRange(dashboardDateFrom.value, dashboardDateTo.value)
  const labels = currentRange.map(formatDayLabel)
  const previousPeriod = getPreviousPeriod(dashboardDateFrom.value, dashboardDateTo.value)
  const allowedNmIds = new Set(filteredRows.value.map((row) => row.ni))

  const datasets = selectedMetrics.value.flatMap((metricId) => {
    const option = metricOptions.find((metric) => metric.id === metricId)
    if (!option) return []

    let currentMap = new Map<string, number>()
    let previousMap = new Map<string, number>()

    switch (metricId) {
      case 'sales':
        currentMap = sumByDate(store.sales, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.pa || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.sales, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.pa || 0, (row) => row.ni)
        }
        break
      case 'returns':
        currentMap = sumByDate(store.returns, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.pa || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.returns, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.pa || 0, (row) => row.ni)
        }
        break
      case 'ordersSum':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.os || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.os || 0, (row) => row.ni)
        }
        break
      case 'ordersCount':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.oc || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.oc || 0, (row) => row.ni)
        }
        break
      case 'buyoutSum':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.bs || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.bs || 0, (row) => row.ni)
        }
        break
      case 'buyoutCount':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.bc_cnt || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.bc_cnt || 0, (row) => row.ni)
        }
        break
      case 'cartCount':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.cc || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.cc || 0, (row) => row.ni)
        }
        break
      case 'openCount':
        currentMap = sumByDate(store.productOrders, dashboardDateFrom.value, dashboardDateTo.value, allowedNmIds, (row) => row.dt, (row) => row.vsc || 0, (row) => row.ni)
        if (previousPeriod) {
          previousMap = sumByDate(store.productOrders, previousPeriod.from, previousPeriod.to, allowedNmIds, (row) => row.dt, (row) => row.vsc || 0, (row) => row.ni)
        }
        break
      default:
        break
    }

    const currentDataset = {
      label: option.label,
      data: currentRange.map((date) => currentMap.get(date) || 0),
      color: option.color,
      unit: option.unit,
    }

    if (!previousPeriod) {
      return [currentDataset]
    }

    const previousRange = buildDateRange(previousPeriod.from, previousPeriod.to)
    const previousDataset = {
      label: `${option.label} (пред. период)`,
      data: previousRange.map((date) => previousMap.get(date) || 0),
      color: option.color,
      unit: option.unit,
      dashed: true,
    }

    return [currentDataset, previousDataset]
  })

  return { labels, datasets }
})

const isDashboardLoading = ref(false)
const isLoading = computed(() => isDashboardLoading.value)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`
}

const formatCommission = (amount: number, percent: number): string => {
  return `${formatCurrency(amount)} (${formatPercent(percent)})`
}

const formatWithPercent = (amount: number, percent: number, label: string): string => {
  return `${formatCurrency(amount)}\n${label} ${formatPercent(percent)}`
}

const formatCount = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(value)
}

const formatOrders = (amount: number, count: number): string => {
  return `${formatCurrency(amount)}\n${formatCount(count)} шт`
}

const formatSales = (amount: number, count: number): string => {
  return `${formatCurrency(amount)}\n${formatCount(count)} шт`
}

const refresh = async () => {
  await loadDashboardData()
}

const sourceData = ref<ProductAggregate[]>([])
const previousSourceData = ref<ProductAggregate[]>([])

const {
  searchQuery,
  debouncedQuery,
  selectedVendorCodes,
  selectedSubjects,
  selectedBrands,
  includeNoBrand,
  filteredRows,
} = useDashboardFilter(sourceData)

const previousFilteredRows = computed(() => {
  return filterProducts(previousSourceData.value, {
    selectedVendorCodes: selectedVendorCodes.value,
    selectedSubjects: selectedSubjects.value,
    selectedBrands: selectedBrands.value,
    includeNoBrand: includeNoBrand.value,
    query: debouncedQuery.value,
  })
})

const getPreviousPeriod = (from: string, to: string) => {
  if (!from || !to) return null
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null
  }
  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
  if (diffDays <= 0) return null
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(diffDays - 1))
  return { from: prevFrom, to: prevTo }
}

const calcDeltaPercent = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

const formatDeltaPercent = (value: number): string => {
  if (!Number.isFinite(value)) return '0.0%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const dashboardData = computed(() => {
  const rows = filteredRows.value
  const dateFrom = dashboardDateFrom.value || ''
  const dateTo = dashboardDateTo.value || ''
  const periodLabel = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'Текущий период'
  const previousPeriod = dateFrom && dateTo ? getPreviousPeriod(dateFrom, dateTo) : null

  const totals = ReportTotalsCalculator.calculateTotals(
    rows,
    store.storageCosts,
    store.acceptanceCosts,
    dateFrom || undefined,
    dateTo || undefined
  )

  const returnsSum = rows.reduce((sum, product) => sum + (product.returnsRevenue || 0), 0)

  const previousRows = previousFilteredRows.value
  const previousTotals = previousPeriod && previousRows.length
    ? ReportTotalsCalculator.calculateTotals(
      previousRows,
      store.storageCosts,
      store.acceptanceCosts,
      previousPeriod.from,
      previousPeriod.to
    )
    : ReportTotalsCalculator.calculateTotals(
      [],
      store.storageCosts,
      store.acceptanceCosts,
      undefined,
      undefined
    )

  const previousReturnsSum = previousRows.reduce((sum, product) => sum + (product.returnsRevenue || 0), 0)

  const deltas = {
    ordersSum: calcDeltaPercent(totals.totalOrdersSum, previousTotals.totalOrdersSum),
    salesBeforeSpp: calcDeltaPercent(totals.totalRevenue, previousTotals.totalRevenue),
    salesAfterSpp: calcDeltaPercent(totals.totalRevenueAfterSpp, previousTotals.totalRevenueAfterSpp),
    sppAmount: calcDeltaPercent(totals.totalSppAmount, previousTotals.totalSppAmount),
    sppPercent: calcDeltaPercent(totals.totalSppPercent, previousTotals.totalSppPercent),
    netPay: calcDeltaPercent(totals.totalTransferAmount, previousTotals.totalTransferAmount),
    commissionAmount: calcDeltaPercent(totals.totalCommissionAmount, previousTotals.totalCommissionAmount),
    logistics: calcDeltaPercent(totals.totalLogistics, previousTotals.totalLogistics),
    storageCosts: calcDeltaPercent(totals.totalStorageCosts, previousTotals.totalStorageCosts),
    advCosts: calcDeltaPercent(totals.totalAdvCosts, previousTotals.totalAdvCosts),
    unitCosts: calcDeltaPercent(totals.totalUnitCosts, previousTotals.totalUnitCosts),
    profit: calcDeltaPercent(totals.totalProfit, previousTotals.totalProfit),
    totalReturns: calcDeltaPercent(returnsSum, previousReturnsSum),
  }

  return {
    totals: {
      totalSales: totals.totalNetRevenue,
      salesBeforeSpp: totals.totalRevenue,
      salesAfterSpp: totals.totalRevenueAfterSpp,
      totalReturns: returnsSum,
      logistics: totals.totalLogistics,
      netPay: totals.totalTransferAmount,
      ordersSum: totals.totalOrdersSum,
      ordersCount: totals.totalOrdersCount,
      netSalesCount: totals.totalNetSalesCount,
      commissionAmount: totals.totalCommissionAmount,
      commissionPercent: totals.totalCommissionPercent,
      sppAmount: totals.totalSppAmount,
      sppPercent: totals.totalSppPercent,
      storageCosts: totals.totalStorageCosts,
      advCosts: totals.totalAdvCosts,
      unitCosts: totals.totalUnitCosts,
      roiPercent: totals.totalRoiPercent,
      profit: totals.totalProfit,
      marginPercent: totals.totalMarginPercent,
    },
    deltas,
    deltaText: Object.fromEntries(
      Object.entries(deltas).map(([key, value]) => [key, formatDeltaPercent(value)])
    ) as Record<keyof typeof deltas, string>,
    weeks: [
      {
        weekId: periodLabel,
        period: periodLabel,
        totalSales: totals.totalNetRevenue,
        salesBeforeSpp: totals.totalRevenue,
        totalReturns: returnsSum,
        logistics: totals.totalLogistics,
        netPay: totals.totalTransferAmount,
      },
    ],
  }
})

const DASHBOARD_PERIOD_KEY = 'dashboard_period'
const dashboardDateFrom = ref<string>('')
const dashboardDateTo = ref<string>('')

const loadDashboardData = async () => {
  const from = dashboardDateFrom.value
  const to = dashboardDateTo.value
  if (!from || !to) return
  isDashboardLoading.value = true
  try {
    sourceData.value = await store.aggregateReportForPeriod(from, to)
    const previous = getPreviousPeriod(from, to)
    previousSourceData.value = previous
      ? await store.aggregateReportForPeriod(previous.from, previous.to)
      : []
  } finally {
    isDashboardLoading.value = false
  }
}

onMounted(() => {
  const saved = localStorage.getItem(DASHBOARD_PERIOD_KEY)
  if (!saved) return
  try {
    const parsed = JSON.parse(saved) as { from?: string; to?: string }
    if (parsed.from && parsed.to) {
      dashboardDateFrom.value = parsed.from
      dashboardDateTo.value = parsed.to
    }
  } catch {
    localStorage.removeItem(DASHBOARD_PERIOD_KEY)
  }
})

watch([dashboardDateFrom, dashboardDateTo], async ([from, to]) => {
  if (!from || !to) return
  localStorage.setItem(DASHBOARD_PERIOD_KEY, JSON.stringify({ from, to }))
  await loadDashboardData()
})

const isFiltersOpen = ref(false)
const activeFilterTab = ref<'subject' | 'vendorCode' | 'brand' | 'article'>('subject')
const filterSearch = ref('')
const draftVendorCodes = ref<string[]>([])
const draftSubjects = ref<string[]>([])
const draftBrands = ref<string[]>([])
const draftIncludeNoBrand = ref(false)
const draftSearchQuery = ref('')

const openFilters = () => {
  draftVendorCodes.value = [...selectedVendorCodes.value]
  draftSubjects.value = [...selectedSubjects.value]
  draftBrands.value = [...selectedBrands.value]
  draftIncludeNoBrand.value = includeNoBrand.value
  draftSearchQuery.value = searchQuery.value
  filterSearch.value = ''
  isFiltersOpen.value = true
}

const closeFilters = () => {
  isFiltersOpen.value = false
}

const applyFilters = () => {
  selectedVendorCodes.value = [...draftVendorCodes.value]
  selectedSubjects.value = [...draftSubjects.value]
  selectedBrands.value = [...draftBrands.value]
  includeNoBrand.value = draftIncludeNoBrand.value
  searchQuery.value = draftSearchQuery.value.trim()
  closeFilters()
}

const resetFilters = () => {
  draftVendorCodes.value = []
  draftSubjects.value = []
  draftBrands.value = []
  draftIncludeNoBrand.value = false
  draftSearchQuery.value = ''
  filterSearch.value = ''
  applyFilters()
}

const toggleDraftVendorCode = (code: string) => {
  const index = draftVendorCodes.value.indexOf(code)
  if (index === -1) {
    draftVendorCodes.value.push(code)
  } else {
    draftVendorCodes.value.splice(index, 1)
  }
}

const toggleDraftSubject = (code: string) => {
  const index = draftSubjects.value.indexOf(code)
  if (index === -1) {
    draftSubjects.value.push(code)
  } else {
    draftSubjects.value.splice(index, 1)
  }
}

const toggleDraftBrand = (code: string) => {
  const index = draftBrands.value.indexOf(code)
  if (index === -1) {
    draftBrands.value.push(code)
  } else {
    draftBrands.value.splice(index, 1)
  }
}

const vendorOptions = computed(() => {
  const vendorMap = new Map<string, { code: string; title?: string }>()

  sourceData.value.forEach((product: ProductAggregate) => {
    if (product.sa && !vendorMap.has(product.sa)) {
      vendorMap.set(product.sa, {
        code: product.sa,
        title: product.title,
      })
    }
  })

  return Array.from(vendorMap.values()).sort((a, b) => a.code.localeCompare(b.code))
})

const subjectOptions = computed(() => {
  const subjectSet = new Set<string>()
  for (const product of sourceData.value) {
    if (product.sj) {
      subjectSet.add(product.sj)
    }
  }
  return Array.from(subjectSet)
    .sort((a, b) => a.localeCompare(b))
    .map((subject) => ({ code: subject }))
})

const filteredSubjectOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return subjectOptions.value
  return subjectOptions.value.filter((subject) => subject.code.toLowerCase().includes(query))
})

const filteredVendorOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return vendorOptions.value
  return vendorOptions.value.filter((vendor) => {
    const title = vendor.title?.toLowerCase() || ''
    return vendor.code.toLowerCase().includes(query) || title.includes(query)
  })
})

const brandOptions = computed(() => {
  const brandSet = new Set<string>()
  for (const product of sourceData.value) {
    if (product.bc) {
      brandSet.add(product.bc)
    }
  }
  return Array.from(brandSet)
    .sort((a, b) => a.localeCompare(b))
    .map((brand) => ({ code: brand }))
})

const filteredBrandOptions = computed(() => {
  const query = filterSearch.value.trim().toLowerCase()
  if (!query) return brandOptions.value
  return brandOptions.value.filter((brand) => brand.code.toLowerCase().includes(query))
})

const activeFiltersCount = computed(() => {
  return (
    selectedVendorCodes.value.length +
    selectedSubjects.value.length +
    selectedBrands.value.length +
    (includeNoBrand.value ? 1 : 0) +
    (searchQuery.value.trim() ? 1 : 0)
  )
})

// TODO: Восстановить после реализации wbStore
// Автоматически обновляем данные после завершения синхронизации
// watch(() => store.isSyncing, (isSyncing, wasSyncing) => {
//   // Когда foreground синхронизация завершается (переходит из true в false)
//   if (wasSyncing && !isSyncing) {
//     console.log('Foreground синхронизация завершена, обновляю данные дашборда...')
//     fetch()
//   }
// })

// TODO: Восстановить после реализации wbStore
// Реактивное обновление данных при загрузке background синхронизации
// Обновляем каждые 10 секунд, если идет background синхронизация
// watch(() => store.isBackgroundSyncing, (isRunning) => {
//   if (isRunning) {
//     // Запускаем периодическое обновление данных каждые 10 секунд
//     backgroundRefreshInterval = window.setInterval(() => {
//       console.log('Обновление данных дашборда (background синхронизация активна)...')
//       fetch()
//     }, 10000)
//   } else {
//     // Останавливаем обновление когда background синхронизация завершена
//     if (backgroundRefreshInterval) {
//       clearInterval(backgroundRefreshInterval)
//       backgroundRefreshInterval = null
//       // Финальное обновление при завершении
//       fetch()
//     }
//   }
// })

onMounted(() => {
  loadDashboardData()
})

onBeforeUnmount(() => {
  // TODO: Восстановить после реализации wbStore
  // Очищаем интервал при размонтировании компонента
  // if (backgroundRefreshInterval) {
  //   clearInterval(backgroundRefreshInterval)
  //   backgroundRefreshInterval = null
  // }
})
</script>
