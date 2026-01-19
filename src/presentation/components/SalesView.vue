<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Продажи</h2>
      <PeriodFilter />
    </div>

    <!-- Таблица продаж -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Артикул
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Размер
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Количество
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Цена продажи
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма продажи
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                К выплате
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Поставка
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="sale in filteredSales" :key="sale.pk" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ formatDate(sale.dt) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ sale.sa || sale.ni }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ sale.sz || '—' }}
              </td>
              <td class="px-4 py-3 text-sm text-right text-gray-600">
                {{ sale.qt || 0 }}
              </td>
              <td class="px-4 py-3 text-sm text-right text-gray-900">
                {{ formatCurrency(sale.pv || 0) }}
              </td>
              <td class="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                {{ formatCurrency(sale.pa || 0) }}
              </td>
              <td class="px-4 py-3 text-sm text-right text-gray-900">
                {{ formatCurrency(sale.pz || 0) }}
              </td>
              <td class="px-4 py-3 text-sm">
                <router-link
                  v-if="sale.gi_id"
                  :to="`/shipments?supplyId=${sale.gi_id}`"
                  class="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {{ sale.gi_id }}
                </router-link>
                <span v-else class="text-gray-400">—</span>
              </td>
            </tr>

            <!-- Пустое состояние -->
            <tr v-if="filteredSales.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                {{ !store.filters.dateFrom || !store.filters.dateTo ? 'Выберите период' : 'Нет данных' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import PeriodFilter from './PeriodFilter.vue'
import type { ISale } from '../../types/db'

const store = useAnalyticsStore()

// Фильтрация продаж по периоду
const filteredSales = computed<ISale[]>(() => {
  const sales = store.sales
  const dateFrom = store.filters.dateFrom
  const dateTo = store.filters.dateTo

  if (!dateFrom || !dateTo) {
    return []
  }

  return sales.filter(sale => {
    return sale.dt >= dateFrom && sale.dt <= dateTo
  })
})

// Форматирование даты
const formatDate = (dateString: string): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
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
</script>


