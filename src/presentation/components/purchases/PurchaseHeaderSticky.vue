<template>
  <div class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
    <div class="px-6 py-3 max-w-6xl mx-auto">
      <!-- Основная информация -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 flex-wrap">
          <div>
            <label class="block text-xs text-gray-600 mb-0.5">Дата</label>
            <input
              type="date"
              :value="formData.date"
              @input="$emit('update:date', ($event.target as HTMLInputElement).value)"
              class="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              :class="{ 'border-red-500': !formData.date }"
            />
          </div>
          
          <div>
            <label class="block text-xs text-gray-600 mb-0.5">Номер</label>
            <input
              type="text"
              :value="formData.orderNumber"
              @input="$emit('update:orderNumber', ($event.target as HTMLInputElement).value)"
              placeholder="№ заказа"
              class="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
              :class="{ 'border-red-500': !formData.orderNumber?.trim() }"
            />
          </div>
          
          <div>
            <label class="block text-xs text-gray-600 mb-0.5">Статус</label>
            <select
              :value="formData.status"
              @change="$emit('update:status', ($event.target as HTMLSelectElement).value)"
              class="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="pending">Ожидает</option>
              <option value="ordered">Заказано</option>
              <option value="shipped">Отправлено</option>
              <option value="received">Получено</option>
            </select>
          </div>

          <div class="flex items-end">
            <button
              type="button"
              @click="showAdvancedLocal = !showAdvancedLocal"
              class="px-3 py-1 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {{ showAdvancedLocal ? 'Скрыть' : 'Доп.параметры' }}
            </button>
          </div>
        </div>

        <!-- Итоги -->
        <PurchaseTotalsChips :totals="totals" :total-r-u-b="purchaseTotalRUB" />
      </div>

      <!-- Дополнительные параметры -->
      <PurchaseAdvancedFields
        :exchange-rate="formData.exchangeRate"
        :buyer-commission-percent="formData.buyerCommissionPercent"
        :logistics-to-moscow="formData.logisticsToMoscow"
        :is-open="showAdvancedLocal"
        @update:exchangeRate="$emit('update:exchangeRate', $event)"
        @update:buyerCommissionPercent="$emit('update:buyerCommissionPercent', $event)"
        @update:logisticsToMoscow="$emit('update:logisticsToMoscow', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IPurchase } from '../../../types/db'
import type { PurchaseSummary } from '../../../core/domain/purchases/types'
import PurchaseTotalsChips from './PurchaseTotalsChips.vue'
import PurchaseAdvancedFields from './PurchaseAdvancedFields.vue'

defineProps<{
  formData: Omit<IPurchase, 'id'>
  totals: PurchaseSummary
  purchaseTotalRUB: number
}>()

defineEmits<{
  'update:date': [value: string]
  'update:orderNumber': [value: string]
  'update:status': [value: string]
  'update:exchangeRate': [value: number]
  'update:buyerCommissionPercent': [value: number]
  'update:logisticsToMoscow': [value: number]
}>()

const showAdvancedLocal = ref(false)
</script>

