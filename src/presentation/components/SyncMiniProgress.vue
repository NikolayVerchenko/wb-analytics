<template>
  <Transition name="slide-up">
    <div
      v-if="show"
      class="sync-mini-progress fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-40 max-w-sm"
    >
      <div class="flex items-center gap-3">
        <!-- Индикатор загрузки -->
        <div
          v-if="isSyncing"
          class="flex-shrink-0"
        >
          <Loader2 class="w-5 h-5 text-blue-600 animate-spin" />
        </div>
        
        <!-- Текст прогресса -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900">
            {{ statusText }}
          </div>
          <div
            v-if="backgroundStats.remaining > 0"
            class="text-xs text-gray-500 mt-1"
          >
            Осталось {{ backgroundStats.remaining }} недель
          </div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { container } from '@core/di/container'
import { useWbStore } from '../stores/wbStore'

const store = useWbStore()

const backgroundStats = ref<{ remaining: number; currentWeek?: string }>({ remaining: 0 })
let statsInterval: number | null = null

const updateBackgroundStats = async () => {
  try {
    const coordinator = container.getSyncCoordinator()
    const stats = await coordinator.getBackgroundSyncStats()
    backgroundStats.value = stats
  } catch (error) {
    console.error('Ошибка при обновлении статистики background синхронизации:', error)
  }
}

const show = computed(() => {
  // Показываем только когда идет background синхронизация
  return store.isBackgroundSyncing && backgroundStats.value.remaining > 0
})

const isSyncing = computed(() => {
  return store.isBackgroundSyncing
})

const statusText = computed(() => {
  const currentWeekId = store.backgroundCurrentWeek || backgroundStats.value.currentWeek
  if (currentWeekId) {
    // Форматируем weekId для отображения (например, "2024-W08" -> "неделя 08 (2024)")
    const match = currentWeekId.match(/^(\d{4})-W(\d{2})$/)
    if (match) {
      const year = match[1]
      const week = match[2]
      return `Загружаем историю: неделя ${week} (${year})...`
    }
    return `Загружаем историю: ${currentWeekId}...`
  }
  return 'Загружаем историю...'
})

const totalWeeks = computed(() => {
  // Получаем общее количество недель из статистики синхронизации
  // Это приблизительная оценка
  return backgroundStats.value.remaining + (store.isBackgroundSyncing ? 0 : 0)
})

const showProgressBar = computed(() => {
  // Показываем прогресс-бар только если есть данные
  return false // Для упрощения скрываем прогресс-бар, оставляя только текст
})

const progressPercentage = computed(() => {
  if (totalWeeks.value === 0) return 0
  const loaded = totalWeeks.value - backgroundStats.value.remaining
  return Math.round((loaded / totalWeeks.value) * 100)
})

watch(() => store.isBackgroundSyncing, (isRunning) => {
  if (isRunning) {
    // Обновляем статистику сразу и затем каждые 5 секунд
    updateBackgroundStats()
    statsInterval = window.setInterval(() => {
      updateBackgroundStats()
    }, 5000)
  } else {
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
    }
  }
})

onMounted(() => {
  // Обновляем статистику, если background синхронизация уже запущена
  if (store.isBackgroundSyncing) {
    updateBackgroundStats()
    statsInterval = window.setInterval(() => {
      updateBackgroundStats()
    }, 5000)
  }
})

onBeforeUnmount(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
    statsInterval = null
  }
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
