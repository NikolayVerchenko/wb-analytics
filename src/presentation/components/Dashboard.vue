<template>
  <div class="space-y-6">
    <!-- Дополнительный контент для страницы дашборда -->
    <div v-if="isDashboardRoute" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Синхронизация данных</h2>
        <SyncButton />
      </div>

      <div>
        <PnLDisplay />
      </div>
    </div>

    <!-- Заголовок -->
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

    <!-- Состояние загрузки -->
    <div v-if="isLoading" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      v-else-if="!data || data.weeks.length === 0"
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
          title="Продажи"
          :value="formatCurrency(data.totals.totalSales)"
          icon="TrendingUp"
          color="blue"
        />
        <MetricCard
          title="Возвраты"
          :value="formatCurrency(data.totals.totalReturns)"
          icon="TrendingDown"
          color="red"
        />
        <MetricCard
          title="Логистика"
          :value="formatCurrency(data.totals.logistics)"
          icon="Truck"
          color="purple"
        />
        <MetricCard
          title="К перечислению"
          :value="formatCurrency(data.totals.netPay)"
          icon="Wallet"
          color="green"
        />
      </div>

      <!-- График -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-4">Динамика по неделям</h3>
        <div class="h-64">
          <BarChart :data="chartData" />
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
              <tr v-for="week in data.weeks" :key="week.weekId" class="hover:bg-gray-50">
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
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, Truck, Wallet } from 'lucide-vue-next'
import { useWeeklyAnalytics } from '../composables/useWeeklyAnalytics'
import { useWbStore } from '../stores/wbStore'
import { SyncButton, PnLDisplay } from './index'
import BarChart from './BarChart.vue'
import MetricCard from './MetricCard.vue'

const { fetch, data, isLoading } = useWeeklyAnalytics()
const store = useWbStore()
const route = useRoute()
const isDashboardRoute = computed(() => route.path === '/' || route.name === 'Dashboard')

let backgroundRefreshInterval: number | null = null

const chartData = computed(() => {
  if (!data.value) return { labels: [], sales: [], returns: [] }
  
  return {
    labels: data.value.weeks.map(w => w.period),
    sales: data.value.weeks.map(w => w.totalSales),
    returns: data.value.weeks.map(w => w.totalReturns),
  }
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const refresh = async () => {
  await fetch()
}

// Автоматически обновляем данные после завершения синхронизации
watch(() => store.isSyncing, (isSyncing, wasSyncing) => {
  // Когда foreground синхронизация завершается (переходит из true в false)
  if (wasSyncing && !isSyncing) {
    console.log('Foreground синхронизация завершена, обновляю данные дашборда...')
    fetch()
  }
})

// Реактивное обновление данных при загрузке background синхронизации
// Обновляем каждые 10 секунд, если идет background синхронизация
watch(() => store.isBackgroundSyncing, (isRunning) => {
  if (isRunning) {
    // Запускаем периодическое обновление данных каждые 10 секунд
    backgroundRefreshInterval = window.setInterval(() => {
      console.log('Обновление данных дашборда (background синхронизация активна)...')
      fetch()
    }, 10000)
  } else {
    // Останавливаем обновление когда background синхронизация завершена
    if (backgroundRefreshInterval) {
      clearInterval(backgroundRefreshInterval)
      backgroundRefreshInterval = null
      // Финальное обновление при завершении
      fetch()
    }
  }
})

onMounted(() => {
  fetch()
})

onBeforeUnmount(() => {
  // Очищаем интервал при размонтировании компонента
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval)
    backgroundRefreshInterval = null
  }
})
</script>
