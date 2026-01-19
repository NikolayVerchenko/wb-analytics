<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex-shrink-0 pb-4 border-b border-gray-200 mb-4">
      <h3 class="text-sm font-semibold text-gray-900">
        Выбрано: {{ selectedProducts.length }}
      </h3>
    </div>

    <!-- Selected Products List -->
    <div class="flex-1 overflow-y-auto space-y-3">
      <template v-if="selectedProducts.length === 0">
        <div class="text-center py-12 text-gray-500">
          <svg
            class="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p class="text-sm">Выберите товары из списка</p>
        </div>
      </template>

      <ProductSizesPanel
        v-for="product in selectedProducts"
        :key="product.ni"
        :nmID="product.ni"
        :title="product.title"
        :vendorCode="product.sa"
        :img="product.img"
        :availableSizes="sizesByNmId[product.ni] || []"
        :selectedSizes="selectedSizesByNmId[product.ni] || []"
        @update:selectedSizes="handleUpdateSizes(product.ni, $event)"
        @remove="handleRemoveSelected"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IProductCard } from '../../../types/db'
import ProductSizesPanel from './ProductSizesPanel.vue'

defineProps<{
  selectedProducts: IProductCard[]
  selectedSizesByNmId: Record<number, string[]>
  sizesByNmId: Record<number, string[]>
}>()

const emit = defineEmits<{
  'update-sizes': [payload: { nmID: number; sizes: string[] }]
  'remove-selected': [payload: { nmID: number }]
}>()

const handleUpdateSizes = (nmID: number, sizes: string[]) => {
  emit('update-sizes', { nmID, sizes })
}

const handleRemoveSelected = (nmID: number) => {
  emit('remove-selected', { nmID })
}
</script>
