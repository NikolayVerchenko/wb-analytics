<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
      <Activity class="w-5 h-5 text-blue-600" />
      Состояние данных
    </h2>

    <!-- Блоки актуальности и глубины истории -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <!-- Актуальность -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="text-sm text-blue-700 font-medium mb-1">Свежие данные</div>
        <div class="text-lg font-semibold text-blue-900">
          <template v-if="lastLoadedDate">
            ✅ Загружены по {{ formatDate(lastLoadedDate) }}
          </template>
          <template v-else>
            <span class="text-gray-500">Данные не загружены</span>
          </template>
        </div>
      </div>

      <!-- Глубина истории -->
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div class="text-sm text-purple-700 font-medium mb-1">История</div>
        <div class="text-lg font-semibold text-purple-900">
          <template v-if="firstLoadedDate">
            📅 Загружено с {{ formatDate(firstLoadedDate) }}
          </template>
          <template v-else>
            <span class="text-gray-500">История не загружена</span>
          </template>
        </div>
      </div>
    </div>

    <!-- Доступный период -->
    <div v-if="firstLoadedDate && lastLoadedDate" class="mb-4 p-3 bg-gray-50 rounded-lg">
      <div class="text-sm text-gray-600 space-y-1">
        <div>
          <strong>Доступный период:</strong> 
          С {{ formatDateShort(firstLoadedDate) }} по {{ formatDateShort(lastLoadedDate) }}
        </div>
        <div class="text-xs text-gray-500 mt-1 flex items-center gap-4">
          <span>☁️ Daily (черновик) — временные дневные данные</span>
          <span>💎 Weekly (финал) — официальный недельный отчет</span>
        </div>
      </div>
    </div>

    <!-- Таймлайн -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>{{ formatDateShort(MIN_DATE) }}</span>
        <span class="font-medium">{{ formatDateShort(today) }}</span>
      </div>

      <!-- Прогресс-бар таймлайна -->
      <div class="relative h-8 bg-gray-200 rounded-full overflow-hidden">
        <!-- Закрашенная область (загруженные периоды) -->
        <div
          class="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
          :style="{ width: `${progressPercentage}%` }"
        />

        <!-- Индикатор текущей загрузки (если идет фоновая синхронизация) -->
        <div
          v-if="isBackgroundSyncing && backgroundCurrentWeek"
          class="absolute inset-y-0 border-2 border-yellow-400 bg-yellow-400 bg-opacity-30 animate-pulse"
          :style="{ left: `${backgroundWeekPosition}%`, width: '2%' }"
        />

        <!-- Текст поверх прогресс-бара -->
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-semibold text-white drop-shadow">
            {{ progressPercentage }}% загружено
          </span>
        </div>
      </div>
    </div>

    <!-- Статус синхронизации -->
    <div class="flex items-center gap-2 text-sm mb-4">
      <template v-if="statusText">
        <Loader2 v-if="isSyncing || isBackgroundSyncing" class="w-4 h-4 text-blue-600 animate-spin" />
        <CheckCircle2 v-else class="w-4 h-4 text-green-600" />
        <span :class="isSyncing || isBackgroundSyncing ? 'text-blue-700' : 'text-green-700'">
          {{ statusText }}
        </span>
      </template>
      <template v-else>
        <span class="text-gray-500">Статус неизвестен</span>
      </template>
    </div>

    <!-- Лог последних событий -->
    <div class="border-t border-gray-200 pt-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Последние события</h3>
      <div class="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
        <div v-if="recentEvents.length === 0" class="text-xs text-gray-500 text-center py-2">
          Нет событий
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="event in recentEvents"
            :key="event.id"
            class="text-xs flex items-start gap-2"
          >
            <span class="text-gray-400 font-mono shrink-0">
              {{ formatEventTime(event.timestamp) }}
            </span>
            <span
              :class="{
                'text-green-600': event.level === 'success',
                'text-blue-600': event.level === 'info',
                'text-orange-600': event.level === 'warn',
                'text-red-600': event.level === 'error',
              }"
            >
              {{ event.message }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Activity, Loader2, CheckCircle2 } from 'lucide-vue-next'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '../stores/wbStore'
// import { type LogEntry, loggerService } from '@application/services/LoggerService'

// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
const store = {
  firstLoadedDate: null as Date | null,
  lastLoadedDate: null as Date | null,
  totalProgressPercentage: 0,
  backgroundCurrentWeek: null as string | null,
  backgroundRemainingWeeks: 0,
  isSyncing: false,
  isBackgroundSyncing: false,
}

const MIN_DATE = new Date('2024-01-29T00:00:00Z')
const today = new Date()

const firstLoadedDate = computed(() => store.firstLoadedDate)
const lastLoadedDate = computed(() => store.lastLoadedDate)
const progressPercentage = computed(() => store.totalProgressPercentage)
const backgroundCurrentWeek = computed(() => store.backgroundCurrentWeek)
const backgroundTotalWeeks = computed(() => store.backgroundTotalWeeks || 0)

let updateInterval: number | null = null

const updateHealthData = async () => {
  // TODO: Восстановить после реализации метода в store
  // Обновляем данные в store (они будут доступны через computed свойства)
  // await store.updateDetailedProgress()
}

const isSyncing = computed(() => store.isSyncing)
const isBackgroundSyncing = computed(() => store.isBackgroundSyncing)

const statusText = computed(() => {
  if (isSyncing.value) {
    return 'Проверка свежих данных...'
  }
  if (isBackgroundSyncing.value) {
    const remaining = store.backgroundRemainingWeeks
    const total = backgroundTotalWeeks.value
    if (remaining > 0 && total > 0) {
      const loaded = total - remaining
      return `Актуальные данные загружены. Идет фоновая загрузка истории: ${loaded} из ${total} недель`
    }
    if (backgroundCurrentWeek.value) {
      const match = backgroundCurrentWeek.value.match(/^(\d{4})-W(\d{2})$/)
      if (match) {
        return `Сбор архива... Загружаем данные за неделю ${match[2]} (${match[1]})`
      }
      return `Сбор архива... Загружаем ${backgroundCurrentWeek.value}`
    }
    return 'Сбор архива...'
  }
  if (progressPercentage.value === 100) {
    return 'Синхронизация завершена. Все данные загружены'
  }
  if (lastLoadedDate.value) {
    return 'Актуальные данные загружены. История синхронизирована'
  }
  return 'Ожидание синхронизации'
})

const formatDate = (date: Date | null): string => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatDateShort = (date: Date | null): string => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const backgroundWeekPosition = ref<number>(0)
const recentEvents = ref<LogEntry[]>([])

const formatEventTime = (date: Date): string => {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const updateRecentEvents = () => {
  // TODO: Восстановить после реализации LoggerService
  // Получаем последние 5 событий из лога
  // const allLogs = loggerService.getLogs()
  // recentEvents.value = allLogs
  //   .filter(log => log.level === 'success' || log.message.includes('финал') || log.message.includes('замен'))
  //   .slice(-5)
  //   .reverse()
  recentEvents.value = []
}

const updateWeekPosition = async () => {
  if (backgroundCurrentWeek.value) {
    try {
      const { DatePeriodService } = await import('@core/services/DatePeriodService')
      const datePeriodService = new DatePeriodService()
      const weekStart = datePeriodService.getWeekStartDate(backgroundCurrentWeek.value)
      if (weekStart) {
        const totalDays = Math.ceil((today.getTime() - MIN_DATE.getTime()) / (1000 * 60 * 60 * 24))
        const daysFromStart = Math.ceil((weekStart.getTime() - MIN_DATE.getTime()) / (1000 * 60 * 60 * 24))
        backgroundWeekPosition.value = Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100))
      } else {
        backgroundWeekPosition.value = 0
      }
    } catch (e) {
      backgroundWeekPosition.value = 0
    }
  } else {
    backgroundWeekPosition.value = 0
  }
}

// Обновляем данные при изменении статуса синхронизации или текущей недели
watch([isSyncing, isBackgroundSyncing, backgroundCurrentWeek], () => {
  updateHealthData()
  updateWeekPosition()
})

onMounted(() => {
  updateHealthData()
  updateWeekPosition()
  updateRecentEvents()
  
  // TODO: Восстановить после добавления метода subscribe в LoggerService
  // Подписываемся на изменения логов
  // loggerService.subscribe(() => {
  //   updateRecentEvents()
  // })
  
  // Обновляем данные каждые 5 секунд
  updateInterval = window.setInterval(() => {
    updateHealthData()
    updateWeekPosition()
  }, 5000)
})

onBeforeUnmount(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
})
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
