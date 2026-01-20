<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Рука на пульсе</h2>
          <p class="text-sm text-gray-500">Ежедневные сигналы по воронке, затратам и марже</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
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
          <PeriodFilter v-model:dateFrom="dateFrom" v-model:dateTo="dateTo" />
        </div>
      </div>
    </div>

    <div class="bg-white p-5 rounded-lg shadow space-y-4">
      <div class="flex flex-wrap items-center gap-3 text-xs text-gray-700">
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
      <div class="text-xs text-gray-500">
        Показы и CTR будут доступны после подключения метрик показов.
      </div>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-base font-semibold text-gray-900">Дневная сводка</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full border-separate border-spacing-0">
          <thead class="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Метрика
              </th>
              <th
                v-for="(label, index) in tableLabels"
                :key="`${label}-${index}`"
                class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {{ label }}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr
              v-for="row in tableRows"
              :key="row.id"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                {{ row.label }}
              </td>
              <td
                v-for="(cell, index) in row.cells"
                :key="`${row.id}-${index}`"
                class="px-4 py-3 text-right align-top"
              >
                <div class="text-sm font-semibold text-gray-900">
                  {{ cell.value }}
                </div>
                <div v-if="cell.deltaText" class="text-xs" :class="cell.deltaClass">
                  {{ cell.deltaText }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="!tableRows.length"
        class="p-8 text-center text-sm text-gray-500"
      >
        Выберите метрики, чтобы построить таблицу.
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
import { computed, onMounted, ref, watch } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import { useDashboardFilter } from '../composables/useDashboardFilter'
import { filterProducts } from '../composables/useProductFilter'
import PeriodFilter from './PeriodFilter.vue'
import { addDays } from '../../application/sync/date'
import type { ProductAggregate } from '../../types/analytics'

type MetricUnit = 'count' | 'percent' | 'currency'

type MetricId =
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cartCount'
  | 'cartConversion'
  | 'orders'
  | 'orderConversion'
  | 'advCosts'
  | 'logisticsCosts'
  | 'unitCosts'

type MetricOption = {
  id: MetricId
  label: string
  color: string
  unit: MetricUnit
}

const metricOptions: MetricOption[] = [
  { id: 'orders', label: 'Заказы', color: 'rgb(99, 102, 241)', unit: 'count' },
  { id: 'clicks', label: 'Клики', color: 'rgb(59, 130, 246)', unit: 'count' },
  { id: 'cartCount', label: 'Корзины', color: 'rgb(34, 197, 94)', unit: 'count' },
  { id: 'cartConversion', label: 'Конверсия в корзину', color: 'rgb(132, 204, 22)', unit: 'percent' },
  { id: 'orderConversion', label: 'Конверсия в заказ', color: 'rgb(168, 85, 247)', unit: 'percent' },
  { id: 'advCosts', label: 'Затраты на рекламу', color: 'rgb(249, 115, 22)', unit: 'currency' },
  { id: 'logisticsCosts', label: 'Затраты на логистику', color: 'rgb(239, 68, 68)', unit: 'currency' },
  { id: 'unitCosts', label: 'Себестоимость', color: 'rgb(71, 85, 105)', unit: 'currency' },
  { id: 'impressions', label: 'Показы', color: 'rgb(148, 163, 184)', unit: 'count' },
  { id: 'ctr', label: 'CTR', color: 'rgb(14, 165, 233)', unit: 'percent' },
]

const selectedMetrics = ref<MetricId[]>([
  'orders',
  'clicks',
  'cartCount',
  'cartConversion',
  'orderConversion',
  'advCosts',
  'logisticsCosts',
  'unitCosts',
])

const store = useAnalyticsStore()
const dateFrom = ref<string>('')
const dateTo = ref<string>('')
const PULSE_PERIOD_KEY = 'pulse_period'

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
  getDate: (record: T) => string,
  getValue: (record: T) => number
): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const record of records) {
    const date = getDate(record)
    if (date < from || date > to) continue
    const value = getValue(record)
    if (!Number.isFinite(value)) continue
    totals.set(date, (totals.get(date) || 0) + value)
  }
  return totals
}

const getMetricSeries = (from: string, to: string, allowedNmIds: Set<number>) => {
  const range = buildDateRange(from, to)
  const productOrders = store.productOrders
  const advCosts = store.advCosts
  const logistics = store.logistics
  const sales = store.sales
  const unitCostMap = new Map(store.unitCosts.map((item) => [item.ni, item.cost || 0]))

  const clickMap = sumByDate(
    productOrders.filter((row) => allowedNmIds.has(row.ni)),
    from,
    to,
    (row) => row.dt,
    (row) => row.vsc || 0
  )
  const cartMap = sumByDate(
    productOrders.filter((row) => allowedNmIds.has(row.ni)),
    from,
    to,
    (row) => row.dt,
    (row) => row.cc || 0
  )
  const orderMap = sumByDate(
    productOrders.filter((row) => allowedNmIds.has(row.ni)),
    from,
    to,
    (row) => row.dt,
    (row) => row.oc || 0
  )
  const advMap = sumByDate(
    advCosts.filter((row) => allowedNmIds.has(row.ni)),
    from,
    to,
    (row) => row.dt,
    (row) => row.costs || 0
  )
  const logisticsMap = sumByDate(
    logistics.filter((row) => allowedNmIds.has(row.ni)),
    from,
    to,
    (row) => row.dt,
    (row) => row.dr || 0
  )

  const unitCostMapByDate = new Map<string, number>()
  for (const sale of sales) {
    if (sale.dt < from || sale.dt > to) continue
    if (!allowedNmIds.has(sale.ni)) continue
    const unitCost = unitCostMap.get(sale.ni)
    if (!unitCost || !sale.qt) continue
    unitCostMapByDate.set(
      sale.dt,
      (unitCostMapByDate.get(sale.dt) || 0) + unitCost * sale.qt
    )
  }

  const seriesByMetric = new Map<MetricId, number[]>()

  seriesByMetric.set('impressions', range.map(() => 0))
  seriesByMetric.set('clicks', range.map((date) => clickMap.get(date) || 0))
  seriesByMetric.set(
    'ctr',
    range.map(() => 0)
  )
  seriesByMetric.set('cartCount', range.map((date) => cartMap.get(date) || 0))
  seriesByMetric.set(
    'cartConversion',
    range.map((date) => {
      const clicks = clickMap.get(date) || 0
      const carts = cartMap.get(date) || 0
      return clicks > 0 ? (carts / clicks) * 100 : 0
    })
  )
  seriesByMetric.set('orders', range.map((date) => orderMap.get(date) || 0))
  seriesByMetric.set(
    'orderConversion',
    range.map((date) => {
      const carts = cartMap.get(date) || 0
      const orders = orderMap.get(date) || 0
      return carts > 0 ? (orders / carts) * 100 : 0
    })
  )
  seriesByMetric.set('advCosts', range.map((date) => advMap.get(date) || 0))
  seriesByMetric.set('logisticsCosts', range.map((date) => logisticsMap.get(date) || 0))
  seriesByMetric.set('unitCosts', range.map((date) => unitCostMapByDate.get(date) || 0))

  return {
    range,
    labels: range.map(formatDayLabel),
    seriesByMetric,
  }
}

const chartDataByUnit = computed(() => {
  if (!dateFrom.value || !dateTo.value) {
    return { labels: [], count: [], percent: [], currency: [] }
  }

  const allowedNmIds = new Set(filteredRows.value.map((row) => row.ni))
  const { labels, seriesByMetric } = getMetricSeries(dateFrom.value, dateTo.value, allowedNmIds)
  const selectedSet = new Set(selectedMetrics.value)

  const datasets = metricOptions
    .filter((metric) => selectedSet.has(metric.id))
    .map((metric) => ({
      label: metric.label,
      data: seriesByMetric.get(metric.id) || [],
      color: metric.color,
      unit: metric.unit,
    }))

  return {
    labels,
    count: datasets.filter((dataset) => dataset.unit === 'count'),
    percent: datasets.filter((dataset) => dataset.unit === 'percent'),
    currency: datasets.filter((dataset) => dataset.unit === 'currency'),
  }
})

const tableLabels = computed(() => chartDataByUnit.value.labels)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCompact = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const formatValue = (value: number, unit: MetricUnit): string => {
  if (unit === 'currency') return formatCurrency(value)
  if (unit === 'percent') return formatPercent(value)
  return formatCompact(value)
}

const formatDelta = (current: number, previous: number, unit: MetricUnit) => {
  if (previous === 0 && current === 0) {
    return { text: null, cls: 'text-gray-400' }
  }
  if (previous === 0) {
    return { text: '+100%', cls: 'text-green-600' }
  }
  const diff = ((current - previous) / previous) * 100
  const sign = diff > 0 ? '+' : ''
  const cls = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'
  if (unit === 'percent') {
    return { text: `${sign}${diff.toFixed(1)}%`, cls }
  }
  return { text: `${sign}${diff.toFixed(1)}%`, cls }
}

const tableRows = computed(() => {
  if (!chartDataByUnit.value.labels.length) return []
  const selectedSet = new Set(selectedMetrics.value)

  return metricOptions
    .filter((metric) => selectedSet.has(metric.id))
    .map((metric) => {
      const series = chartDataByUnit.value
      const dataset =
        series.count.find((item) => item.label === metric.label) ||
        series.percent.find((item) => item.label === metric.label) ||
        series.currency.find((item) => item.label === metric.label)

      const data = dataset?.data || []
      const cells = data.map((value, index) => {
        const previous = index > 0 ? data[index - 1] : 0
        const delta = formatDelta(value, previous, metric.unit)
        return {
          value: formatValue(value, metric.unit),
          deltaText: delta.text,
          deltaClass: delta.cls,
        }
      })

      return {
        id: metric.id,
        label: metric.label,
        cells,
      }
    })
})

onMounted(() => {
  const saved = localStorage.getItem(PULSE_PERIOD_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { from?: string; to?: string }
      if (parsed.from && parsed.to) {
        dateFrom.value = parsed.from
        dateTo.value = parsed.to
        return
      }
    } catch {
      localStorage.removeItem(PULSE_PERIOD_KEY)
    }
  }

  const today = new Date()
  const to = today.toISOString().split('T')[0]
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - 13)
  dateFrom.value = fromDate.toISOString().split('T')[0]
  dateTo.value = to
})

const loadPulseData = async () => {
  if (!dateFrom.value || !dateTo.value) return
  sourceData.value = await store.aggregateReportForPeriod(dateFrom.value, dateTo.value)
  const previous = getPreviousPeriod(dateFrom.value, dateTo.value)
  previousSourceData.value = previous
    ? await store.aggregateReportForPeriod(previous.from, previous.to)
    : []
}

watch([dateFrom, dateTo], async ([from, to]) => {
  if (from && to) {
    localStorage.setItem(PULSE_PERIOD_KEY, JSON.stringify({ from, to }))
    await loadPulseData()
  }
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
</script>
