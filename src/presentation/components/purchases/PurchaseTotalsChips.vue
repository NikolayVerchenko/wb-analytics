<template>
  <div class="flex items-center gap-1.5">
    <div class="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700">
      <span class="text-gray-600">Вес:</span>
      <span class="ml-1 font-semibold">{{ totals.totalWeight.toFixed(3) }} кг</span>
    </div>
    
    <div class="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700">
      <span class="text-gray-600">Товаров:</span>
      <span class="ml-1 font-semibold">{{ totals.totalItems }}</span>
    </div>
    
    <div class="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700">
      <span class="text-gray-600">Кол-во:</span>
      <span class="ml-1 font-semibold">{{ totals.totalQuantity }}</span>
    </div>
    
    <div class="bg-blue-100 px-2 py-0.5 rounded-full text-xs font-medium text-blue-700">
      <span class="text-blue-600">Итого:</span>
      <span class="ml-1 font-semibold">{{ totalRUB.toFixed(2) }} ₽</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PurchaseSummary } from '../../../core/domain/purchases/types'

defineProps<{
  totals: PurchaseSummary
  totalRUB: number
}>()
</script>

