<template>
  <div class="border-b border-gray-200 mb-4">
    <nav class="-mb-px flex space-x-8">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('tab-change', tab.id)"
        :class="[
          'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors',
          activeTab === tab.id
            ? 'border-purple-500 text-purple-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]"
      >
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeTab: 'all' | 'pending' | 'ordered' | 'shipped' | 'received'
}>()

defineEmits<{
  'tab-change': [tab: 'all' | 'pending' | 'ordered' | 'shipped' | 'received']
}>()

const tabs = [
  { id: 'all' as const, label: 'Все' },
  { id: 'pending' as const, label: 'Черновики' },
  { id: 'ordered' as const, label: 'Заказано' },
  { id: 'shipped' as const, label: 'В пути' },
  { id: 'received' as const, label: 'Получено' },
]
</script>
