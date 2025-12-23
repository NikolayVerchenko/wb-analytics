<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-2xl font-bold mb-4">Прибыль и убытки</h2>
    
    <div class="mb-4">
      <label class="block mb-2">Дата от:</label>
      <input
        v-model="dateFrom"
        type="date"
        class="border rounded px-3 py-2"
      />
    </div>
    
    <div class="mb-4">
      <label class="block mb-2">Дата до:</label>
      <input
        v-model="dateTo"
        type="date"
        class="border rounded px-3 py-2"
      />
    </div>
    
    <button
      @click="handleCalculate"
      :disabled="isLoading"
      class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
    >
      {{ isLoading ? 'Расчет...' : 'Рассчитать' }}
    </button>

    <div v-if="result" class="mt-6 space-y-2">
      <div class="text-lg">
        <span class="font-semibold">Выручка:</span>
        <span class="ml-2">{{ formatCurrency(result.revenue) }}</span>
      </div>
      <div class="text-lg">
        <span class="font-semibold">Расходы:</span>
        <span class="ml-2 text-red-600">{{ formatCurrency(result.expenses) }}</span>
      </div>
      <div class="text-xl font-bold">
        <span>Прибыль:</span>
        <span class="ml-2" :class="result.profit >= 0 ? 'text-green-600' : 'text-red-600'">
          {{ formatCurrency(result.profit) }}
        </span>
      </div>
      <div class="text-lg">
        <span class="font-semibold">Маржа:</span>
        <span class="ml-2" :class="result.margin >= 0 ? 'text-green-600' : 'text-red-600'">
          {{ result.margin.toFixed(2) }}%
        </span>
      </div>
    </div>

    <div v-if="error" class="mt-4 text-red-500">
      Ошибка: {{ error.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePnL } from '../composables/usePnL'
import { ref, computed } from 'vue'

const { calculate, result, isLoading, error } = usePnL()

const dateFrom = ref('2024-01-01')
const dateTo = ref(new Date().toISOString().split('T')[0])

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(value)
}

const handleCalculate = async () => {
  try {
    await calculate({
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    })
  } catch (err) {
    console.error('Calculate error:', err)
  }
}
</script>
