<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Логи запуска</h2>
      <button
        class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50"
        @click="clearLogs"
      >
        Очистить
      </button>
    </div>

    <div class="bg-white rounded-lg shadow border border-gray-100">
      <div v-if="logs.length === 0" class="p-6 text-gray-500 text-sm">
        Логов пока нет.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="log in logs"
          :key="log.at + log.message"
          class="flex items-start gap-4 px-5 py-3 text-sm"
        >
          <div class="w-32 text-gray-500 font-mono">
            {{ formatTime(log.at) }}
          </div>
          <div class="w-20">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="levelClass(log.level)"
            >
              {{ log.level }}
            </span>
          </div>
          <div class="text-gray-800">
            {{ log.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore } from '@/stores/analyticsStore'

const store = useAnalyticsStore()
const logs = computed(() => store.startupLogs)

const formatTime = (iso: string) => iso.slice(0, 19).replace('T', ' ')

const levelClass = (level: 'info' | 'warn' | 'error') => {
  if (level === 'error') {
    return 'bg-red-100 text-red-700'
  }
  if (level === 'warn') {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-blue-100 text-blue-700'
}

const clearLogs = () => {
  store.startupLogs.splice(0, store.startupLogs.length)
}
</script>
