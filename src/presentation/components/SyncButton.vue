<template>
  <button
    @click="handleSync"
    :disabled="isSyncing"
    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span v-if="isSyncing">Синхронизация... ({{ progress.current }}/{{ progress.total }})</span>
    <span v-else>Синхронизировать данные</span>
  </button>
  <div v-if="error" class="mt-2 text-red-500 text-sm">
    Ошибка: {{ error.message }}
  </div>
</template>

<script setup lang="ts">
import { useSyncData } from '../composables/useSyncData'
import { ref } from 'vue'

const { sync, isSyncing, progress, error } = useSyncData()

const dateFrom = ref('2024-01-01')
const dateTo = ref(new Date().toISOString().split('T')[0])

const handleSync = async () => {
  try {
    await sync({
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      syncOrders: true,
      syncSales: true,
      syncExpenses: true,
    })
    alert('Синхронизация завершена успешно!')
  } catch (err) {
    console.error('Sync error:', err)
  }
}
</script>
