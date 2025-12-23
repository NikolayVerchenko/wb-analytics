<template>
  <div class="space-y-6">
    <!-- Панель состояния данных -->
    <div class="mb-6">
      <DataHealthPanel />
    </div>

    <!-- Настройка синхронизации -->
  <div class="bg-white p-6 rounded-lg shadow">
      <h2 class="text-xl font-semibold mb-4">Управление синхронизацией</h2>

    <!-- Настройка API ключа -->
    <div class="mb-4 p-4 bg-gray-50 rounded">
      <label class="block text-sm font-medium mb-2">API ключ Wildberries:</label>
      <div class="flex gap-2">
        <input
          v-model="apiKeyInput"
          type="password"
          placeholder="Введите API ключ"
          class="flex-1 border rounded px-3 py-2"
        />
        <button
          @click="saveApiKey"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Сохранить
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        Ключ сохраняется в localStorage браузера
      </p>
    </div>

    <!-- Статус синхронизации -->
    <div v-if="store.isSyncing || store.isBackgroundSyncing" class="mb-4">
      <!-- Монитор логов синхронизации -->
      <SyncLogMonitor v-if="store.isSyncing" :height="300" class="mb-4" />
      <div class="flex items-center justify-between mb-2">
        <span class="font-medium">Синхронизация в процессе...</span>
        <button
          @click="store.abortSync"
          class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
        >
          Остановить
        </button>
      </div>

      <div v-if="store.syncProgress" class="space-y-2">
        <div class="flex justify-between text-sm">
          <span>Неделя: {{ store.currentPeriod }}</span>
          <span>{{ store.syncProgress.currentWeekIndex }} / {{ store.syncProgress.totalWeeks }}</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-blue-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${store.progressPercentage}%` }"
          ></div>
        </div>
        <div class="text-sm text-gray-600 space-y-1">
          <div>Всего загружено записей: {{ store.totalLoaded }}</div>
          <div v-if="store.syncProgress.currentWeekStatus" class="mt-2 p-2 bg-blue-50 rounded text-xs">
            <div class="font-medium mb-1">
              Обработка недели: {{ store.syncProgress.currentWeekStatus.period }}
            </div>
            <div class="space-y-0.5">
              <div>Найдено строк: {{ store.syncProgress.currentWeekStatus.rawRecords }}</div>
              <div v-if="store.syncProgress.currentWeekStatus.aggregatedRecords > 0">
                После агрегации: {{ store.syncProgress.currentWeekStatus.aggregatedRecords }}
                (продажи: {{ store.syncProgress.currentWeekStatus.salesCount }}, 
                возвраты: {{ store.syncProgress.currentWeekStatus.returnsCount }})
              </div>
              <div v-if="store.syncProgress.currentWeekStatus.salesCount > 0 || store.syncProgress.currentWeekStatus.returnsCount > 0" class="mt-1 font-semibold text-green-700">
                Сохранено: {{ store.syncProgress.currentWeekStatus.salesCount }} продаж и {{ store.syncProgress.currentWeekStatus.returnsCount }} возвратов
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Выбор периода загрузки -->
    <div class="mb-4 p-4 bg-gray-50 rounded">
      <label class="block text-sm font-medium mb-3">Период загрузки:</label>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Дата от:</label>
          <input
            v-model="dateFrom"
            type="date"
            :min="minDate"
            :max="maxDate"
            class="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Дата до:</label>
          <input
            v-model="dateTo"
            type="date"
            :min="minDate"
            :max="maxDate"
            class="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        Минимальная дата: 29.01.2024
      </p>
    </div>

    <!-- Кнопки запуска -->
    <div class="flex gap-2">
      <button
        @click="handleStartSyncFull"
        :disabled="store.isSyncing || !hasApiKey"
        class="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="store.isSyncing">Синхронизация...</span>
        <span v-else>Загрузить все (с 29.01.2024)</span>
      </button>
      <button
        @click="handleStartSyncCustom"
        :disabled="store.isSyncing || !hasApiKey || !isDateRangeValid"
        class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="store.isSyncing">Синхронизация...</span>
        <span v-else>Загрузить период</span>
      </button>
    </div>

    <!-- Ошибка -->
    <div v-if="store.error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ store.error }}
    </div>

    <!-- Информация -->
    <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
      <p class="font-medium mb-1">Информация:</p>
      <ul class="list-disc list-inside space-y-1 text-xs">
        <li>Можно загрузить все данные (с 29.01.2024) или выбрать период</li>
        <li>Интервал загрузки: недельные периоды</li>
        <li>Пауза между запросами: 10 секунд</li>
        <li>Уже загруженные недели пропускаются автоматически</li>
      </ul>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWbStore } from '../stores/wbStore'
import SyncLogMonitor from './SyncLogMonitor.vue'
import DataHealthPanel from './DataHealthPanel.vue'

const store = useWbStore()
const apiKeyInput = ref('')

// Даты по умолчанию
const minDate = '2024-01-29'
const maxDate = new Date().toISOString().split('T')[0]

const dateFrom = ref('2024-01-29')
const dateTo = ref(maxDate)

const hasApiKey = computed(() => {
  return !!store.getApiKey()
})

const isDateRangeValid = computed(() => {
  if (!dateFrom.value || !dateTo.value) return false
  
  // Сравниваем только даты (без времени), чтобы избежать проблем с часовыми поясами
  const fromDate = new Date(dateFrom.value + 'T00:00:00')
  const toDate = new Date(dateTo.value + 'T00:00:00')
  const minDateObj = new Date(minDate + 'T00:00:00')
  
  // Получаем сегодняшнюю дату (только дата, без времени)
  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
  const minDateOnly = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate())
  
  return fromDateOnly >= minDateOnly && toDateOnly >= fromDateOnly && toDateOnly <= todayDateOnly && fromDateOnly <= todayDateOnly
})

let progressUpdateInterval: number | null = null

onMounted(() => {
  // Загружаем сохраненный ключ при монтировании
  const savedKey = store.getApiKey()
  if (savedKey) {
    apiKeyInput.value = savedKey
  }

  // Обновляем детальный прогресс при открытии страницы настроек
  store.updateDetailedProgress()

  // Обновляем прогресс каждые 5 секунд
  progressUpdateInterval = window.setInterval(() => {
    store.updateDetailedProgress()
  }, 5000)
})

onBeforeUnmount(() => {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval)
    progressUpdateInterval = null
  }
})

const saveApiKey = async () => {
  if (apiKeyInput.value.trim()) {
    const apiKey = apiKeyInput.value.trim()
    store.setApiKey(apiKey)
    
    // Переинициализируем DIContainer с новым ключом
    try {
      const { container } = await import('@core/di/container')
      const containerWithReinit = container as typeof container & { reinitialize: (key?: string) => void }
      if (typeof containerWithReinit.reinitialize === 'function') {
        containerWithReinit.reinitialize(apiKey)
      }
    } catch (err) {
      console.warn('Не удалось переинициализировать DI контейнер:', err)
    }
    
    alert('API ключ сохранен')
  } else {
    alert('Введите API ключ')
  }
}

const handleStartSyncFull = async () => {
  try {
    await store.startSync()
    if (!store.error) {
    alert('Синхронизация завершена успешно!')
    }
  } catch (error) {
    // Ошибка уже отображается в store.error
    console.error('Ошибка синхронизации:', error)
    
    // Дополнительное сообщение для 401 ошибки
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMsg = (error as Error).message
      if (errorMsg.includes('401') || errorMsg.includes('401')) {
        alert('Ошибка авторизации (401). Проверьте правильность API ключа в настройках.')
      }
    }
  }
}

const handleStartSyncCustom = async () => {
  if (!isDateRangeValid.value) {
    alert('Проверьте правильность выбранных дат')
    return
  }

  // Дополнительная проверка на будущие даты (сравниваем только даты без времени)
  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  
  // Создаем даты в UTC, чтобы избежать проблем с часовыми поясами
  const fromDate = new Date(dateFrom.value + 'T00:00:00Z')
  const toDate = new Date(dateTo.value + 'T23:59:59Z')
  const fromDateOnly = new Date(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  const toDateOnly = new Date(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate())
  
  if (fromDateOnly > todayDateOnly || toDateOnly > todayDateOnly) {
    alert('Даты не могут быть в будущем. Выберите даты до сегодняшнего дня.')
    return
  }

  try {
    await store.startSync(fromDate, toDate)
    if (!store.error) {
    alert('Синхронизация завершена успешно!')
    }
  } catch (error) {
    // Ошибка уже отображается в store.error
    console.error('Ошибка синхронизации:', error)
    
    // Дополнительное сообщение для 401 ошибки
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMsg = (error as Error).message
      if (errorMsg.includes('401') || errorMsg.includes('401')) {
        alert('Ошибка авторизации (401). Проверьте правильность API ключа в настройках.')
      }
    }
  }
}
</script>
