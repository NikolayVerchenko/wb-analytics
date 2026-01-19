<template>
  <div class="space-y-4">
    <!-- Quick Actions -->
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-gray-900">Размеры</h4>
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
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      <label
        v-for="size in availableSizes"
        :key="size"
        class="flex items-center p-3 border rounded-lg cursor-pointer transition-colors"
        :class="{
          'border-blue-500 bg-blue-50': isSelected(size),
          'border-gray-200 hover:bg-gray-50': !isSelected(size),
        }"
      >
        <input
          type="checkbox"
          :checked="isSelected(size)"
          @change="toggleSize(size)"
          class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span class="ml-3 text-sm font-medium text-gray-900">{{ size }}</span>
      </label>
    </div>

    <!-- Empty State -->
    <div v-if="availableSizes.length === 0" class="text-center py-8 text-gray-500">
      <p class="text-sm">Размеры не найдены</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  availableSizes: string[]
  selectedSizes: string[]
}>()

const emit = defineEmits<{
  'update:selectedSizes': [sizes: string[]]
}>()

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
</script>

