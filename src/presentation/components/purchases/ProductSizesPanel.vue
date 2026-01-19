<template>
  <div class="border border-gray-200 rounded-lg p-4 bg-white">
    <!-- Product Header -->
    <div class="flex items-start gap-3 mb-4">
      <!-- Product Image -->
      <div class="flex-shrink-0">
        <img
          v-if="img && !imageError"
          :src="img"
          :alt="title"
          class="w-12 h-12 object-cover rounded-lg"
          @error="imageError = true"
          loading="lazy"
        />
        <div
          v-else
          class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <!-- Product Info -->
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-gray-900 mb-1 line-clamp-2" :title="title">
          {{ title || `Артикул ${nmID}` }}
        </h4>
        <div class="text-xs text-gray-500 mb-2">
          <div>nmID: {{ nmID }}</div>
          <div v-if="vendorCode">Vendor: {{ vendorCode }}</div>
        </div>
        <!-- Selected Count Badge -->
        <div v-if="selectedSizes.length > 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          Выбрано: {{ selectedSizes.length }}
        </div>
      </div>

      <!-- Remove Button -->
      <button
        type="button"
        @click="handleRemove"
        class="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1"
        title="Удалить товар из выбора"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Size Selection -->
    <div class="space-y-3">
      <!-- Quick Actions -->
      <div class="flex items-center justify-between">
        <h5 class="text-xs font-medium text-gray-700">Размеры</h5>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="selectAll"
            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Выбрать все
          </button>
          <span class="text-gray-300">|</span>
          <button
            type="button"
            @click="clearAll"
            class="text-xs text-gray-600 hover:text-gray-700 font-medium"
          >
            Очистить
          </button>
        </div>
      </div>

      <!-- Sizes Grid -->
      <div class="flex flex-wrap gap-2">
        <label
          v-for="size in availableSizes"
          :key="size"
          class="flex items-center px-3 py-2 border rounded-lg cursor-pointer transition-colors"
          :class="{
            'border-blue-500 bg-blue-50': isSelected(size),
            'border-gray-200 hover:bg-gray-50': !isSelected(size),
          }"
        >
          <input
            type="checkbox"
            :checked="isSelected(size)"
            @change="toggleSize(size)"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
          />
          <span class="text-sm font-medium text-gray-900">{{ size }}</span>
        </label>
      </div>

      <!-- Empty State -->
      <div v-if="availableSizes.length === 0" class="text-center py-4 text-gray-500">
        <p class="text-xs">Размеры не найдены</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  nmID: number
  title: string
  vendorCode: string
  img?: string
  availableSizes: string[]
  selectedSizes: string[]
}>()

const emit = defineEmits<{
  'update:selectedSizes': [sizes: string[]]
  'remove': [nmID: number]
}>()

const imageError = ref(false)

const isSelected = (size: string): boolean => {
  return props.selectedSizes.includes(size)
}

const toggleSize = (size: string) => {
  const newSizes = [...props.selectedSizes]
  const index = newSizes.indexOf(size)

  if (index > -1) {
    newSizes.splice(index, 1)
  } else {
    newSizes.push(size)
  }

  emit('update:selectedSizes', newSizes)
}

const selectAll = () => {
  emit('update:selectedSizes', [...props.availableSizes])
}

const clearAll = () => {
  emit('update:selectedSizes', [])
}

const handleRemove = () => {
  emit('remove', props.nmID)
}
</script>
