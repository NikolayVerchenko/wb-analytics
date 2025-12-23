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
