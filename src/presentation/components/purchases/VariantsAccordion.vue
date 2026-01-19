<template>
  <div class="mt-4 pt-4 border-t border-slate-200">
    <button
      type="button"
      @click="isOpenLocal = !isOpenLocal"
      class="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
    >
      <span>Размеры ({{ group.items.length }})</span>
      <svg
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': isOpenLocal }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <div v-if="isOpenLocal" class="mt-3">
      <VariantsTable
        :items="group.items"
        :calculate-item-cost="calculateItemCost"
        @remove-item="(nmID, techSize) => $emit('remove-item', nmID, techSize)"
        @update-variant-field="(nmID, techSize, field, value) => $emit('update-variant-field', nmID, techSize, field, value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { GroupedPurchase } from '../../../core/domain/purchases/types'
import type { ItemCostCalculation } from '../../../core/domain/purchases/types'
import type { IPurchaseItem } from '../../../types/db'
import VariantsTable from './VariantsTable.vue'

defineProps<{
  group: GroupedPurchase
  calculateItemCost: (item: IPurchaseItem) => ItemCostCalculation
}>()

defineEmits<{
  'remove-item': [nmID: number, techSize: string]
  'update-variant-field': [nmID: number, techSize: string, field: 'quantity' | 'priceCNY', value: number]
}>()

const isOpenLocal = ref(false)
</script>

