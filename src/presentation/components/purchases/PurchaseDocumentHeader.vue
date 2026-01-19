<template>
  <div class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
    <div class="max-w-6xl mx-auto px-6 py-2.5">
      <!-- Compact Header: All in one row -->
      <div class="flex items-center justify-between gap-4">
        <!-- Left: Title + Status + Metadata inline -->
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <h1 class="text-base font-semibold text-gray-900 whitespace-nowrap">Закупка из Китая</h1>
          
          <!-- Status Badge -->
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
            :class="getStatusBadgeClass(formData.status)"
          >
            {{ getStatusText(formData.status) }}
          </span>

          <!-- Metadata: Date, Order Number, Status - compact inline -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <input
              type="date"
              :value="formData.date"
              @input="$emit('update:date', ($event.target as HTMLInputElement).value)"
              class="h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              :class="{ 'border-red-500': !formData.date }"
              title="Дата закупки"
            />
            
            <input
              type="text"
              :value="formData.orderNumber"
              @input="$emit('update:orderNumber', ($event.target as HTMLInputElement).value)"
              placeholder="№"
              class="h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent w-20"
              :class="{ 'border-red-500': !formData.orderNumber?.trim() }"
              title="Номер заказа"
            />

            <select
              :value="formData.status"
              @change="$emit('update:status', ($event.target as HTMLSelectElement).value)"
              class="h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
              title="Статус закупки"
            >
              <option value="pending">Ожидает</option>
              <option value="ordered">Заказано</option>
              <option value="shipped">Отправлено</option>
              <option value="received">Получено</option>
            </select>
          </div>

          <!-- Subtitle inline -->
          <span class="text-xs text-gray-500 whitespace-nowrap ml-2">
            {{ isEditing ? `№${formData.orderNumber}` : 'Создание' }}
          </span>
        </div>

        <!-- Right: Totals + Actions -->
        <div class="flex items-center gap-3 flex-shrink-0">
          <!-- Totals Chips -->
          <PurchaseTotalsChips :totals="totals" :total-r-u-b="purchaseTotalRUB" />
          
          <!-- Actions -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="$emit('reset')"
              class="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Очистить
            </button>
            <button
              type="button"
              @click="$emit('save')"
              :disabled="!canSave || isLoading"
              class="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {{ isLoading ? (isEditing ? 'Обновление...' : 'Сохранение...') : 'Сохранить' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IPurchase } from '../../../types/db'
import type { PurchaseSummary } from '../../../core/domain/purchases/types'
import PurchaseTotalsChips from './PurchaseTotalsChips.vue'

defineProps<{
  formData: Omit<IPurchase, 'id'>
  totals: PurchaseSummary
  purchaseTotalRUB: number
  canSave: boolean
  isEditing: boolean
  isLoading?: boolean
}>()

defineEmits<{
  'update:date': [value: string]
  'update:orderNumber': [value: string]
  'update:status': [value: string]
  'save': []
  'reset': []
}>()

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Ожидает',
    ordered: 'Заказано',
    shipped: 'Отправлено',
    received: 'Получено',
  }
  return statusMap[status] || status
}

function getStatusBadgeClass(status: string): string {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    ordered: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    received: 'bg-green-100 text-green-800',
  }
  return classMap[status] || 'bg-slate-100 text-slate-800'
}
</script>
