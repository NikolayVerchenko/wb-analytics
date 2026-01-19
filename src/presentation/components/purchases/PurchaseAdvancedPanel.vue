<template>
  <div class="max-w-6xl mx-auto px-6 pt-2 pb-4">
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1.5">
            Курс CNY/RUB
          </label>
          <input
            type="number"
            :value="exchangeRate"
            @input="handleUpdate('exchangeRate', parseFloat(($event.target as HTMLInputElement).value) || 0)"
            step="0.01"
            min="0"
            placeholder="12.50"
            class="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1.5">
            Комиссия покупателя (%)
          </label>
          <input
            type="number"
            :value="buyerCommissionPercent"
            @input="handleUpdate('buyerCommissionPercent', parseFloat(($event.target as HTMLInputElement).value) || 0)"
            step="0.1"
            min="0"
            max="100"
            placeholder="5.0"
            class="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1.5">
            Логистика до МСК (₽)
          </label>
          <input
            type="number"
            :value="logisticsToMoscow"
            @input="handleUpdate('logisticsToMoscow', parseFloat(($event.target as HTMLInputElement).value) || 0)"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  exchangeRate: number
  buyerCommissionPercent: number
  logisticsToMoscow: number
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
