<template>
  <div v-if="isOpen" class="mt-4 pt-4 border-t border-slate-200">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-xs text-gray-600 mb-2">Курс CNY/RUB</label>
        <input
          type="number"
          :value="exchangeRate"
          @input="handleUpdate('exchangeRate', parseFloat(($event.target as HTMLInputElement).value) || 0)"
          step="0.01"
          min="0"
          placeholder="12.50"
          class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label class="block text-xs text-gray-600 mb-2">Комиссия (%)</label>
        <input
          type="number"
          :value="buyerCommissionPercent"
          @input="handleUpdate('buyerCommissionPercent', parseFloat(($event.target as HTMLInputElement).value) || 0)"
          step="0.1"
          min="0"
          max="100"
          placeholder="5"
          class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label class="block text-xs text-gray-600 mb-2">Логистика до МСК (₽)</label>
        <input
          type="number"
          :value="logisticsToMoscow"
          @input="handleUpdate('logisticsToMoscow', parseFloat(($event.target as HTMLInputElement).value) || 0)"
          step="0.01"
          min="0"
          placeholder="0.00"
          class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  exchangeRate: number
  buyerCommissionPercent: number
  logisticsToMoscow: number
  isOpen: boolean
}>()

const emit = defineEmits<{
  'update:exchangeRate': [value: number]
  'update:buyerCommissionPercent': [value: number]
  'update:logisticsToMoscow': [value: number]
}>()

function handleUpdate(field: 'exchangeRate' | 'buyerCommissionPercent' | 'logisticsToMoscow', value: number) {
  emit(`update:${field}` as any, value)
}
</script>

