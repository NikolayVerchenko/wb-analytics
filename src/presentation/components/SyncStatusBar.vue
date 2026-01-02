<template>
  <div
    v-if="showStatusBar"
    class="sync-status-bar bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200"
  >
    <div class="max-w-7xl mx-auto px-4 py-2">
      <div class="flex flex-col gap-2">
        <!-- Статус foreground синхронизации -->
        <div
          v-if="showForegroundStatus"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <!-- Индикатор загрузки -->
            <div
              v-if="store.isSyncing"
              class="flex items-center gap-2"
            >
              <div class="pulse-dot w-2 h-2 bg-blue-600 rounded-full"></div>
              <span class="text-sm font-medium text-gray-700">
                Получаем свежие данные...
              </span>
            </div>

            <!-- Ожидание данных с таймером -->
            <div
              v-else-if="waitingTask"
              class="flex items-center gap-2"
            >
              <Clock class="w-4 h-4 text-orange-600" />
              <span class="text-sm font-medium text-gray-700">
                Данные за <span class="font-semibold">{{ formatDate(waitingTask.periodId) }}</span> ожидаются.
              </span>
              <span class="text-sm font-semibold text-orange-600">
                Повтор через {{ countdownText }}
              </span>
            </div>

            <!-- Актуальные данные готовы -->
            <div
              v-else
              class="flex items-center gap-2"
            >
              <CheckCircle2 class="w-4 h-4 text-green-600" />
              <span class="text-sm font-medium text-gray-700">
                ✅ Актуальные данные обновлены
              </span>
            </div>
          </div>

          <!-- Прогресс (если есть) -->
          <div v-if="progressText" class="text-xs text-gray-600">
            {{ progressText }}
          </div>
        </div>

        <!-- Статус background синхронизации -->
        <div
          v-if="store.isBackgroundSyncing"
          class="flex items-center justify-between border-t border-blue-200 pt-2"
        >
          <div class="flex items-center gap-2">
            <div class="pulse-dot w-2 h-2 bg-purple-600 rounded-full"></div>
            <span class="text-xs font-medium text-gray-600">
              {{ backgroundStatusText }}
            </span>
          </div>
          <div
            v-if="backgroundRemainingWeeks > 0"
            class="text-xs text-gray-500"
          >
            Осталось {{ backgroundRemainingWeeks }} недель
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Clock, CheckCircle2 } from 'lucide-vue-next'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '../stores/wbStore'
import { container } from '@core/di/container'
import { db } from '@infrastructure/db/database'
import type { SyncRegistryEntry } from '@core/domain/entities/SyncRegistryEntry'

// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
const store = {
  isSyncing: false,
  isBackgroundSyncing: false,
  backgroundCurrentWeek: undefined as string | undefined,
  syncProgress: null as { currentWeekIndex: number; totalWeeks: number } | null,
}

const waitingTask = ref<SyncRegistryEntry | null>(null)
const countdownSeconds = ref<number>(0)
let countdownInterval: number | null = null
let refreshInterval: number | null = null
let backgroundStatsInterval: number | null = null

const backgroundRemainingWeeks = ref<number>(0)
const backgroundCurrentWeek = ref<string | undefined>(undefined)

const updateBackgroundStats = async () => {
  try {
    // TODO: Восстановить после реализации SyncCoordinator
    // const coordinator = container.getSyncCoordinator()
    // const stats = await coordinator.getBackgroundSyncStats()
    // backgroundRemainingWeeks.value = stats.remaining
    // backgroundCurrentWeek.value = stats.currentWeek
    backgroundRemainingWeeks.value = 0
    backgroundCurrentWeek.value = undefined
  } catch (error) {
    console.error('Ошибка при обновлении статистики background синхронизации в статус-баре:', error)
  }
}

const showForegroundStatus = computed(() => {
  return store.isSyncing || waitingTask.value !== null || (!store.isSyncing && !waitingTask.value)
})

const showStatusBar = computed(() => {
  return showForegroundStatus.value || store.isBackgroundSyncing
})

const backgroundStatusText = computed(() => {
  const currentWeekId = store.backgroundCurrentWeek || backgroundCurrentWeek.value
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

const countdownText = computed(() => {
  if (countdownSeconds.value <= 0) return '0:00'
  
  const minutes = Math.floor(countdownSeconds.value / 60)
  const seconds = countdownSeconds.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const progressText = computed(() => {
  // Можно добавить логику для отображения прогресса, например:
  // "Загружено 3 дня из 7"
  if (store.syncProgress && store.syncProgress.totalWeeks > 0) {
    return `${store.syncProgress.currentWeekIndex} / ${store.syncProgress.totalWeeks} недель`
  }
  return null
})

const formatDate = (periodId: string): string => {
  // Форматируем YYYY-MM-DD в DD.MM
  const match = periodId.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    return `${match[3]}.${match[2]}`
  }
  return periodId
}

const updateWaitingTasks = async () => {
  try {
    const now = Date.now()
    
    // Находим задачи со статусом waiting, у которых nextRetryAt > now (еще не готовы к повтору)
    const waitingEntries = await db.syncRegistry
      .where('status')
      .equals('waiting')
      .toArray()
    
    // Берем ближайшую задачу (с минимальным nextRetryAt)
    const upcomingTasks = waitingEntries
      .filter(entry => entry.nextRetryAt && entry.nextRetryAt > now)
      .sort((a, b) => (a.nextRetryAt || 0) - (b.nextRetryAt || 0))
    
    if (upcomingTasks.length > 0) {
      waitingTask.value = upcomingTasks[0]
      updateCountdown()
    } else {
      waitingTask.value = null
      countdownSeconds.value = 0
    }
  } catch (error) {
    console.error('Ошибка при обновлении waiting задач:', error)
  }
}

const updateCountdown = () => {
  if (!waitingTask.value?.nextRetryAt) {
    countdownSeconds.value = 0
    return
  }
  
  const now = Date.now()
  const diff = Math.max(0, Math.floor((waitingTask.value.nextRetryAt - now) / 1000))
  countdownSeconds.value = diff
}

const startCountdown = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
  
  countdownInterval = window.setInterval(() => {
    updateCountdown()
    
    // Если время истекло, обновляем список задач
    if (countdownSeconds.value <= 0) {
      updateWaitingTasks()
    }
  }, 1000)
}

onMounted(() => {
  updateWaitingTasks()
  startCountdown()
  updateBackgroundStats()
  
  // Обновляем каждые 10 секунд на случай изменения в БД
  refreshInterval = window.setInterval(() => {
    updateWaitingTasks()
  }, 10000)

  // Обновляем статистику фоновой загрузки каждые 5 секунд
  backgroundStatsInterval = window.setInterval(() => {
    updateBackgroundStats()
  }, 5000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
  if (backgroundStatsInterval) {
    clearInterval(backgroundStatsInterval)
  }
})
</script>

<style scoped>
.sync-status-bar {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pulse-dot {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
