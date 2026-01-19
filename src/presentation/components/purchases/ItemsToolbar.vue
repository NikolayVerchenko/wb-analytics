<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex-1 max-w-md">
      <div class="relative">
        <svg
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Поиск по названию, nmID, vendor..."
          class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>

    <button
      v-if="!hideAddButton"
      type="button"
      @click="$emit('add-product')"
      class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-2"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      + Добавить товары
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string
  hideAddButton?: boolean
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'add-product': []
}>()
</script>

