<template>
  <div class="overflow-auto max-h-[calc(100vh-300px)] border border-gray-200 rounded-lg">
    <table class="min-w-full border-collapse">
      <!-- Заголовок -->
      <thead class="bg-gray-50 sticky top-0 z-20">
        <tr>
          <th class="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Артикул
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Категория
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Доставки (шт.)
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Отказы (шт.)
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Возвраты (шт.)
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Продажи (кол-во)
          </th>
          <th 
            class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            title="Продажи за период минус возвраты за период"
          >
            Реализация (шт.)
          </th>
          <th 
            class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            title="Отношение реализации к количеству доставок"
          >
            % Выкупа
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Реализация до СПП (₽)
          </th>
          <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Реализация после СПП (₽)
          </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                СПП (%)
            </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                К перечислению
            </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Сумма комиссии ВБ
            </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                % Комиссия ВБ
            </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Логистика
            </th>
            <th 
              class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
              title="Себестоимость одной единицы проданного товара (средневзвешенная)"
            >
                Себестоимость ед.
            </th>
            <th 
              class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
              title="Рассчитано на основе привязанных поставок"
            >
                Себестоимость
            </th>
            <th class="border-b border-r border-gray-200 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Валовая прибыль
            </th>
        </tr>
      </thead>
      
      <tbody class="bg-white divide-y divide-gray-200">
        <!-- Итоговая строка -->
        <tr v-if="total" class="bg-blue-50 font-semibold hover:bg-blue-100">
          <td class="sticky left-0 z-10 bg-blue-50 border-r border-gray-200 px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
            {{ total.sa_name }}
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">—</td>
          <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
            {{ formatNumber(total.deliveryAmount) }}
          </td>
          <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
            {{ formatNumber(total.returnAmount) }}
          </td>
          <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
            {{ formatNumber(total.actualReturns) }}
          </td>
          <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
            {{ formatNumber(total.quantity) }}
          </td>
          <td 
            class="px-4 py-3 text-sm text-right whitespace-nowrap"
            :class="(total.quantity - total.actualReturns) >= 0 ? 'text-gray-900' : 'text-red-600'"
          >
            {{ formatNumber(total.quantity - total.actualReturns) }}
          </td>
          <td 
            class="px-4 py-3 text-sm text-right font-medium whitespace-nowrap"
            :class="
              total.buyoutPercent < 30 ? 'text-red-600' : 
              total.buyoutPercent > 70 ? 'text-green-600' : 
              'text-gray-900'
            "
          >
            {{ total.buyoutPercent.toFixed(1) }}%
          </td>
          <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
            {{ formatCurrency(total.realizationBeforeSppAmount) }}
          </td>
          <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
            {{ formatCurrency(total.realizationAfterSppAmount) }}
          </td>
          <td 
            class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap"
            :class="
              total.sppPercent > 0 ? 'text-red-600' : 
              'text-gray-900'
            "
          >
            {{ total.sppPercent.toFixed(1) }}%
          </td>
          <td class="px-4 py-3 text-sm text-right font-semibold text-green-600 whitespace-nowrap">
            {{ formatCurrency(total.netPay) }}
          </td>
          <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
            {{ formatCurrency(total.wbCommissionAmount) }}
          </td>
          <td 
            class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap"
            :class="
              total.wbCommissionPercent > 0 ? 'text-red-600' : 
              'text-gray-900'
            "
          >
            {{ total.wbCommissionPercent.toFixed(1) }}%
          </td>
          <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
            {{ formatCurrency(total.logistics) }}
          </td>
          <td 
            class="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap"
            :class="total.unitCost && total.unitCost > 0 ? 'text-orange-600' : 'text-gray-400'"
            :title="total.unitCost && total.unitCost > 0 ? 'Себестоимость одной единицы (средневзвешенная)' : 'Нет данных о закупке для этой партии'"
          >
            <span v-if="total.unitCost !== undefined && total.unitCost > 0" class="inline-flex items-center gap-1">
              {{ formatCurrency(total.unitCost) }}
            </span>
            <span v-else class="text-gray-400 inline-flex items-center gap-1">
              0.00 ₽
              <svg class="w-4 h-4 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Нет данных о закупке для этой партии">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </td>
          <td 
            class="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap"
            :class="total.totalCost && total.totalCost > 0 ? 'text-orange-600' : 'text-gray-400'"
            :title="total.totalCost && total.totalCost > 0 ? 'Рассчитано на основе привязанных поставок' : 'Себестоимость не определена'"
          >
            <span v-if="total.totalCost !== undefined && total.totalCost > 0">
              {{ formatCurrency(total.totalCost) }}
            </span>
            <span v-else class="text-red-600">⚠️ 0</span>
          </td>
          <td 
            class="px-4 py-3 text-sm text-right font-bold whitespace-nowrap"
            :class="
              total.grossProfit !== undefined && total.grossProfit > 0 ? 'text-green-600' : 
              total.grossProfit !== undefined && total.grossProfit < 0 ? 'text-red-600' : 
              'text-gray-400'
            "
          >
            {{ total.grossProfit !== undefined ? formatCurrency(total.grossProfit) : '—' }}
          </td>
        </tr>

        <!-- Строки данных -->
        <template v-for="(row, index) in data" :key="`${row.sa_name}-${index}`">
          <!-- Групповая строка (артикул) -->
          <tr
            class="hover:bg-gray-100 cursor-pointer font-medium"
            :class="[
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              { 'bg-blue-50': isRowExpanded(row) }
            ]"
            @click="toggleRow(row)"
          >
            <td 
              class="sticky left-0 z-10 border-r border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap"
              :class="[
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                { 'bg-blue-50': isRowExpanded(row) }
              ]"
            >
              <div class="flex items-center gap-2">
                <ChevronRight
                  :class="{ 'rotate-90': isRowExpanded(row) }"
                  class="w-4 h-4 text-gray-500 transition-transform"
                />
                {{ row.sa_name }}
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
              {{ row.subject_name }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatNumber(row.deliveryAmount) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatNumber(row.returnAmount) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatNumber(row.actualReturns) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatNumber(row.quantity) }}
            </td>
            <td 
              class="px-4 py-3 text-sm text-right whitespace-nowrap"
              :class="(row.quantity - row.actualReturns) >= 0 ? 'text-gray-900' : 'text-red-600'"
            >
              {{ formatNumber(row.quantity - row.actualReturns) }}
            </td>
            <td 
              class="px-4 py-3 text-sm text-right font-medium whitespace-nowrap"
              :class="
                row.buyoutPercent < 30 ? 'text-red-600' : 
                row.buyoutPercent > 70 ? 'text-green-600' : 
                'text-gray-900'
              "
            >
              {{ row.buyoutPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(row.realizationBeforeSppAmount) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(row.realizationAfterSppAmount) }}
            </td>
            <td 
              class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap"
              :class="
                row.sppPercent > 0 ? 'text-red-600' : 
                'text-gray-900'
              "
            >
              {{ row.sppPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-3 text-sm text-right font-semibold text-green-600 whitespace-nowrap">
              {{ formatCurrency(row.netPay) }}
            </td>
            <td class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatCurrency(row.wbCommissionAmount) }}
            </td>
            <td 
              class="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap"
              :class="
                row.wbCommissionPercent > 0 ? 'text-red-600' : 
                'text-gray-900'
              "
            >
              {{ row.wbCommissionPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(row.logistics) }}
            </td>
            <td 
              class="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap"
              :class="
                row.unitCost !== undefined && row.unitCost > 0 ? 'text-orange-600' : 
                'text-gray-400'
              "
              :title="row.unitCost && row.unitCost > 0 ? 'Себестоимость одной единицы (средневзвешенная)' : 'Нет данных о закупке для этой партии'"
            >
              <span v-if="row.unitCost !== undefined && row.unitCost > 0" class="inline-flex items-center gap-1">
                {{ formatCurrency(row.unitCost) }}
              </span>
              <span v-else class="text-gray-400 inline-flex items-center gap-1">
                0.00 ₽
                <svg class="w-4 h-4 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Нет данных о закупке для этой партии">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </td>
            <td 
              class="px-4 py-3 text-sm text-right font-semibold whitespace-nowrap"
              :class="
                row.totalCost !== undefined && row.totalCost > 0 ? 'text-orange-600' : 
                'text-gray-400'
              "
              :title="row.costWarning || (row.totalCost && row.totalCost > 0 ? 'Рассчитано на основе привязанных поставок' : 'Себестоимость не определена')"
            >
              <span v-if="row.costWarning || row.hasPartialCoverage" class="text-red-600 inline-flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <span v-if="row.totalCost !== undefined && row.totalCost > 0">
                {{ formatCurrency(row.totalCost) }}
              </span>
              <span v-else-if="row.costWarning || row.hasPartialCoverage" class="text-red-600">0</span>
              <span v-else>—</span>
            </td>
            <td 
              class="px-4 py-3 text-sm text-right font-bold whitespace-nowrap"
              :class="
                row.grossProfit !== undefined && row.grossProfit > 0 ? 'text-green-600' : 
                row.grossProfit !== undefined && row.grossProfit < 0 ? 'text-red-600' : 
                'text-gray-400'
              "
            >
              {{ row.grossProfit !== undefined ? formatCurrency(row.grossProfit) : '—' }}
            </td>
          </tr>

          <!-- Дочерние строки (размеры) -->
          <tr
            v-for="(child, childIndex) in row.children"
            v-show="isRowExpanded(row)"
            :key="`${row.sa_name}-${child.ts_name}-${childIndex}`"
            :class="[
              childIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              'hover:bg-gray-100'
            ]"
          >
            <td 
              class="sticky left-0 z-10 border-r border-gray-200 px-4 py-2 text-sm text-gray-600 pl-12 whitespace-nowrap"
              :class="[
                childIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              ]"
            >
              <span class="text-gray-400">└─</span> {{ child.ts_name }}
            </td>
            <td class="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
              {{ child.subject_name }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatNumber(child.deliveryAmount) }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatNumber(child.returnAmount) }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatNumber(child.actualReturns) }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatNumber(child.quantity) }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right whitespace-nowrap"
              :class="(child.quantity - child.actualReturns) >= 0 ? 'text-gray-900' : 'text-red-600'"
            >
              {{ formatNumber(child.quantity - child.actualReturns) }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right font-medium whitespace-nowrap"
              :class="
                child.buyoutPercent < 30 ? 'text-red-600' : 
                child.buyoutPercent > 70 ? 'text-green-600' : 
                'text-gray-900'
              "
            >
              {{ child.buyoutPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(child.realizationBeforeSppAmount) }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(child.realizationAfterSppAmount) }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap"
              :class="
                child.sppPercent > 0 ? 'text-red-600' : 
                'text-gray-900'
              "
            >
              {{ child.sppPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-2 text-sm text-right text-green-600 whitespace-nowrap">
              {{ formatCurrency(child.netPay) }}
            </td>
            <td class="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap">
              {{ formatCurrency(child.wbCommissionAmount) }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right text-red-600 whitespace-nowrap"
              :class="
                child.wbCommissionPercent > 0 ? 'text-red-600' : 
                'text-gray-900'
              "
            >
              {{ child.wbCommissionPercent.toFixed(1) }}%
            </td>
            <td class="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
              {{ formatCurrency(child.logistics) }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right font-semibold whitespace-nowrap"
              :class="
                child.unitCost !== undefined && child.unitCost > 0 ? 'text-orange-600' : 
                'text-gray-400'
              "
              :title="child.unitCost && child.unitCost > 0 ? 'Себестоимость одной единицы' : 'Нет данных о закупке для этой партии'"
            >
              <span v-if="child.unitCost !== undefined && child.unitCost > 0" class="inline-flex items-center gap-1">
                {{ formatCurrency(child.unitCost) }}
              </span>
              <span v-else class="text-gray-400 inline-flex items-center gap-1">
                0.00 ₽
                <svg class="w-4 h-4 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Нет данных о закупке для этой партии">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </td>
            <td 
              class="px-4 py-2 text-sm text-right font-semibold whitespace-nowrap"
              :class="
                child.totalCost !== undefined && child.totalCost > 0 ? 'text-orange-600' : 
                'text-gray-400'
              "
              :title="child.costWarning || (child.totalCost && child.totalCost > 0 ? 'Рассчитано на основе привязанных поставок' : 'Себестоимость не определена')"
            >
              <span v-if="child.costWarning" class="text-red-600">⚠️</span>
              {{ child.totalCost !== undefined && child.totalCost > 0 ? formatCurrency(child.totalCost) : (child.costWarning ? '0' : '—') }}
            </td>
            <td 
              class="px-4 py-2 text-sm text-right font-bold whitespace-nowrap"
              :class="
                child.grossProfit !== undefined && child.grossProfit > 0 ? 'text-green-600' : 
                child.grossProfit !== undefined && child.grossProfit < 0 ? 'text-red-600' : 
                'text-gray-400'
              "
            >
              {{ child.grossProfit !== undefined ? formatCurrency(child.grossProfit) : '—' }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { SummaryRow } from '@application/services/SummaryService'

interface Props {
  data: SummaryRow[]
  total: SummaryRow | null
}

const props = defineProps<Props>()

// Создаем реактивную карту для отслеживания состояния разворачивания
const expandedRows = ref<Set<string>>(new Set())

// Синхронизируем expandedRows при изменении props.data
watch(() => props.data, (newData) => {
  // Очищаем состояния для удаленных строк
  const currentKeys = new Set(newData.map(row => row.sa_name))
  expandedRows.value = new Set(
    Array.from(expandedRows.value).filter(key => currentKeys.has(key))
  )
}, { immediate: true })

const toggleRow = (row: SummaryRow) => {
  if (expandedRows.value.has(row.sa_name)) {
    expandedRows.value.delete(row.sa_name)
  } else {
    expandedRows.value.add(row.sa_name)
  }
}

const isRowExpanded = (row: SummaryRow): boolean => {
  return expandedRows.value.has(row.sa_name)
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ₽'
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ru-RU').format(value)
}
</script>

<style scoped>
/* Дополнительные стили для sticky */
th.sticky,
td.sticky {
  position: sticky;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

thead th.sticky {
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
}
</style>
