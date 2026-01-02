<template>
  <div class="sync-log-monitor">
    <!-- Статус-бар -->
    <div 
      v-if="currentStatus" 
      class="status-bar mb-4 p-4 rounded-lg font-semibold text-center"
      :class="statusBarClass"
    >
      {{ currentStatus }}
    </div>

    <!-- Терминал с логами -->
    <div class="terminal-container bg-black rounded-lg p-4 font-mono text-sm">
      <div class="flex justify-between items-center mb-2">
        <div class="text-gray-400 text-xs">Лог синхронизации</div>
        <button
          @click="clearLogs"
          class="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-800"
        >
          Очистить
        </button>
      </div>
      
      <div 
        ref="logContainer" 
        class="log-content overflow-y-auto"
        :style="{ height: `${height}px` }"
      >
        <div v-if="logs.length === 0" class="text-gray-600 text-center py-8">
          Логи появятся здесь во время синхронизации...
        </div>
        
        <div 
          v-for="log in logs" 
          :key="log.id"
          class="log-entry py-1"
          :class="getLogEntryClass(log.level)"
        >
          <span class="timestamp text-gray-500 mr-2">
            {{ formatTime(log.timestamp) }}
          </span>
          <span class="level-badge mr-2" :class="getLevelBadgeClass(log.level)">
            [{{ getLevelLabel(log.level) }}]
          </span>
          <span class="message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
// TODO: Восстановить после реализации LoggerService
// import { type LogEntry, type LogLevel, loggerService } from '@application/services/LoggerService'

// Заглушки типов
type LogLevel = 'info' | 'warn' | 'error' | 'success'
type LogEntry = {
  id: string
  level: LogLevel
  message: string
  timestamp: Date
}

// Заглушка loggerService
const loggerService = {
  getLogs: () => [] as LogEntry[],
  clear: () => {},
}

interface Props {
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
})

const logs = ref<LogEntry[]>([])
const logContainer = ref<HTMLDivElement | null>(null)
const currentStatus = ref<string>('')
let unsubscribe: (() => void) | null = null

// Вычисляем класс для статус-бара на основе последнего лога
const statusBarClass = computed(() => {
  if (logs.value.length === 0) return 'bg-gray-100 text-gray-700'
  
  const lastLog = logs.value[logs.value.length - 1]
  switch (lastLog.level) {
    case 'error':
      return 'bg-red-100 text-red-800 border-2 border-red-300'
    case 'warn':
      return 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
    case 'success':
      return 'bg-green-100 text-green-800 border-2 border-green-300'
    default:
      return 'bg-blue-100 text-blue-800 border-2 border-blue-300'
  }
})

// Обновляем статус-бар на основе последних логов
watch(logs, (newLogs) => {
  if (newLogs.length === 0) {
    currentStatus.value = ''
    return
  }

  const lastLog = newLogs[newLogs.length - 1]
  
  // Формируем статус на основе последнего лога
  if (lastLog.level === 'warn') {
    if (lastLog.message.includes('Лимит запросов')) {
      currentStatus.value = 'ПАУЗА: ЛИМИТ API (повтор через 10 сек)'
    } else if (lastLog.message.includes('Проблема с сетью')) {
      currentStatus.value = 'СЕТЬ НЕДОСТУПНА (повтор через 10 сек)'
    } else {
      currentStatus.value = lastLog.message
    }
  } else if (lastLog.level === 'error') {
    currentStatus.value = `ОШИБКА: ${lastLog.message}`
  } else if (lastLog.level === 'success' && lastLog.message.includes('Неделя')) {
    // Извлекаем номер недели из сообщения
    const weekMatch = lastLog.message.match(/Неделя (\S+)/)
    if (weekMatch) {
      currentStatus.value = `Неделя ${weekMatch[1]} загружена успешно`
    } else {
      currentStatus.value = lastLog.message
    }
  } else if (lastLog.level === 'info' && lastLog.message.includes('Начало загрузки недели')) {
    const weekMatch = lastLog.message.match(/недели (\S+)/)
    if (weekMatch) {
      currentStatus.value = `Идет загрузка: ${weekMatch[1]}`
    } else {
      currentStatus.value = lastLog.message
    }
  } else {
    currentStatus.value = lastLog.message
  }
}, { deep: true })

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const getLevelLabel = (level: LogLevel): string => {
  const labels: Record<LogLevel, string> = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    success: 'SUCCESS',
  }
  return labels[level] || level.toUpperCase()
}

const getLogEntryClass = (level: LogLevel): string => {
  switch (level) {
    case 'error':
      return 'text-red-400'
    case 'warn':
      return 'text-yellow-400'
    case 'success':
      return 'text-green-400'
    default:
      return 'text-gray-300'
  }
}

const getLevelBadgeClass = (level: LogLevel): string => {
  switch (level) {
    case 'error':
      return 'text-red-500 font-bold'
    case 'warn':
      return 'text-yellow-500 font-bold'
    case 'success':
      return 'text-green-500 font-bold'
    default:
      return 'text-blue-400'
  }
}

const clearLogs = () => {
  loggerService.clear()
  currentStatus.value = ''
}

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// Автопрокрутка при появлении новых логов
watch(logs, () => {
  scrollToBottom()
}, { deep: true })

onMounted(() => {
  // TODO: Восстановить после реализации LoggerService
  // Загружаем последние 50 логов
  // const allLogs = loggerService.getLogs()
  // logs.value = allLogs.slice(-50).reverse()
  logs.value = []
  scrollToBottom()

  // TODO: Восстановить после добавления метода subscribe в LoggerService
  // Подписываемся на обновления логов
  // unsubscribe = loggerService.subscribe((newLogs) => {
  //   logs.value = newLogs.slice(-50) // Берем последние 50
  // })
})

onBeforeUnmount(() => {
  // TODO: Восстановить после добавления метода subscribe в LoggerService
  // if (unsubscribe) {
  //   unsubscribe()
  // }
})
</script>

<style scoped>
.sync-log-monitor {
  width: 100%;
}

.terminal-container {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.log-content {
  min-height: 100px;
  line-height: 1.6;
}

.log-entry {
  word-wrap: break-word;
  white-space: pre-wrap;
}

.timestamp {
  user-select: none;
}

.level-badge {
  user-select: none;
  font-weight: 600;
}

.status-bar {
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}
</style>
