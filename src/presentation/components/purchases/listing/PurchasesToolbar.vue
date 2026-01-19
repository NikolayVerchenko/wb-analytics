<template>
  <div class="flex items-center gap-3 mb-4">
    <!-- Поиск -->
    <div class="flex-1 relative">
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
        placeholder="Поиск по номеру заказа, артикулу..."
        class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>

    <!-- Фильтр статуса -->
    <select
      :value="statusFilter"
      @change="$emit('update:statusFilter', ($event.target as HTMLSelectElement).value)"
      class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
    >
      <option value="all">Все статусы</option>
      <option value="pending">Ожидает</option>
      <option value="ordered">Заказано</option>
      <option value="shipped">Отправлено</option>
      <option value="received">Получено</option>
    </select>

    <!-- Кнопка колонок -->
    <button
      @click="$emit('toggle-columns')"
      class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    >
      Колонки
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string
  statusFilter: string
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:statusFilter': [value: string]
  'toggle-columns': []
}>()
</script>
