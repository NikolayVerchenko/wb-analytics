<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Рука на пульсе</h2>
          <p class="text-sm text-gray-500">Ежедневные сигналы по воронке, затратам и марже</p>
        </div>
        <PeriodFilter v-model:dateFrom="dateFrom" v-model:dateTo="dateTo" />
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

    <div class="space-y-5">
      <div v-if="countChart.datasets.length" class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-base font-semibold text-gray-900 mb-3">Воронка (шт/день)</h3>
        <div class="h-72">
          <PulseBarChart :data="countChart" />
        </div>
      </div>

      <div v-if="percentChart.datasets.length" class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-base font-semibold text-gray-900 mb-3">Конверсии</h3>
        <div class="h-72">
          <PulseBarChart :data="percentChart" />
        </div>
      </div>

      <div v-if="currencyChart.datasets.length" class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-base font-semibold text-gray-900 mb-3">Затраты и себестоимость</h3>
        <div class="h-72">
          <PulseBarChart :data="currencyChart" />
        </div>
      </div>

      <div
        v-if="!countChart.datasets.length && !percentChart.datasets.length && !currencyChart.datasets.length"
        class="bg-white p-8 rounded-lg shadow text-center text-sm text-gray-500"
      >
        Выберите метрики, чтобы построить график.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import PeriodFilter from './PeriodFilter.vue'
import PulseBarChart from './PulseBarChart.vue'
import { addDays } from '../../application/sync/date'

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
  { id: 'impressions', label: 'Показы', color: 'rgb(148, 163, 184)', unit: 'count' },
  { id: 'clicks', label: 'Клики', color: 'rgb(59, 130, 246)', unit: 'count' },
  { id: 'ctr', label: 'CTR', color: 'rgb(14, 165, 233)', unit: 'percent' },
  { id: 'cartCount', label: 'Корзины', color: 'rgb(34, 197, 94)', unit: 'count' },
  { id: 'cartConversion', label: 'Конверсия в корзину', color: 'rgb(132, 204, 22)', unit: 'percent' },
  { id: 'orders', label: 'Заказы', color: 'rgb(99, 102, 241)', unit: 'count' },
  { id: 'orderConversion', label: 'Конверсия в заказ', color: 'rgb(168, 85, 247)', unit: 'percent' },
  { id: 'advCosts', label: 'Затраты на рекламу', color: 'rgb(249, 115, 22)', unit: 'currency' },
  { id: 'logisticsCosts', label: 'Затраты на логистику', color: 'rgb(239, 68, 68)', unit: 'currency' },
  { id: 'unitCosts', label: 'Себестоимость', color: 'rgb(71, 85, 105)', unit: 'currency' },
]

const selectedMetrics = ref<MetricId[]>([
  'clicks',
  'cartCount',
  'orders',
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

const getMetricSeries = (from: string, to: string) => {
  const range = buildDateRange(from, to)
  const productOrders = store.productOrders
  const advCosts = store.advCosts
  const logistics = store.logistics
  const sales = store.sales
  const unitCostMap = new Map(store.unitCosts.map((item) => [item.ni, item.cost || 0]))

  const clickMap = sumByDate(productOrders, from, to, (row) => row.dt, (row) => row.vsc || 0)
  const cartMap = sumByDate(productOrders, from, to, (row) => row.dt, (row) => row.cc || 0)
  const orderMap = sumByDate(productOrders, from, to, (row) => row.dt, (row) => row.oc || 0)
  const advMap = sumByDate(advCosts, from, to, (row) => row.dt, (row) => row.costs || 0)
  const logisticsMap = sumByDate(logistics, from, to, (row) => row.dt, (row) => row.dr || 0)

  const unitCostMapByDate = new Map<string, number>()
  for (const sale of sales) {
    if (sale.dt < from || sale.dt > to) continue
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

  const { labels, seriesByMetric } = getMetricSeries(dateFrom.value, dateTo.value)
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

const countChart = computed(() => ({
  labels: chartDataByUnit.value.labels,
  datasets: chartDataByUnit.value.count,
}))

const percentChart = computed(() => ({
  labels: chartDataByUnit.value.labels,
  datasets: chartDataByUnit.value.percent,
}))

const currencyChart = computed(() => ({
  labels: chartDataByUnit.value.labels,
  datasets: chartDataByUnit.value.currency,
}))

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

watch([dateFrom, dateTo], ([from, to]) => {
  if (from && to) {
    localStorage.setItem(PULSE_PERIOD_KEY, JSON.stringify({ from, to }))
  }
})
</script>
