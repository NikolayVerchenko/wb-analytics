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
          :disabled="!canSaveApiKey"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Сохранить
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        Ключ сохраняется в защищенной базе данных приложения
      </p>
      <div v-if="apiKeySaveStatus" class="mt-2 text-sm" :class="apiKeySaveStatus.type === 'success' ? 'text-green-600' : 'text-red-600'">
        {{ apiKeySaveStatus.message }}
      </div>
    </div>

    <!-- Загрузка отчетов о реализации -->
    <div class="mb-6 p-4 bg-gray-50 rounded">
      <h3 class="text-lg font-semibold mb-4">Загрузка отчетов о реализации</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium mb-2">Дата начала (от):</label>
          <input
            v-model="reportDateFrom"
            type="date"
            class="w-full border rounded px-3 py-2"
            :max="maxDate"
            :disabled="isReportSyncing"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Дата окончания (до):</label>
          <input
            v-model="reportDateTo"
            type="date"
            class="w-full border rounded px-3 py-2"
            :max="maxDate"
            :disabled="isReportSyncing"
          />
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button
          @click="loadReports"
          :disabled="isReportSyncing || !canLoadReports || !hasApiKey"
          class="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          :title="!hasApiKey ? 'Введите API-ключ в настройках' : ''"
        >
          {{ isReportSyncing ? 'Загрузка...' : 'Загрузить отчеты' }}
        </button>

        <div v-if="isReportSyncing" class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-gray-600">
            Загружено: {{ reportProgress.loaded }} записей
          </span>
        </div>
      </div>

      <div v-if="reportProgress.error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        Ошибка: {{ reportProgress.error }}
      </div>

      <div v-if="reportProgress.success" class="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
        ✅ Загружено {{ reportProgress.totalLoaded }} записей, сохранено {{ reportProgress.totalSaved }} записей
      </div>
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
          <!-- Индикатор прогресса рекламных расходов -->
          <div v-if="store.adExpensesSyncing" class="mt-2 p-2 bg-purple-50 rounded text-xs">
            <div class="font-medium mb-1 text-purple-700">
              📊 Рекламные расходы
            </div>
            <div class="text-purple-600">
              Синхронизация рекламных расходов (последние 72 часа)...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Выбор типов данных для синхронизации -->
    <!-- TODO: Восстановить после реализации метода startSync в store -->
    <!--
    <div class="mb-4 p-4 bg-gray-50 rounded">
      <label class="block text-sm font-medium mb-3">Типы данных:</label>
      <div class="space-y-2">
        <label class="flex items-center gap-2">
          <input
            v-model="syncOptions.includeAdExpenses"
            type="checkbox"
            class="rounded border-gray-300"
          />
          <span class="text-sm">Рекламные расходы</span>
        </label>
      </div>
    </div>
    -->

    <!-- Кнопка запуска синхронизации -->
    <!-- TODO: Восстановить после реализации метода startSync в store -->
    <!--
    <button
      @click="startSync"
      :disabled="store.isSyncing || store.isBackgroundSyncing"
      class="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
    >
      {{ store.isSyncing || store.isBackgroundSyncing ? 'Синхронизация в процессе...' : 'Запустить синхронизацию' }}
    </button>
    -->
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '@presentation/stores/wbStore'
import DataHealthPanel from './DataHealthPanel.vue'
import SyncLogMonitor from './SyncLogMonitor.vue'
// TODO: Восстановить после реализации ReportSyncUseCase
// import { ReportSyncUseCase } from '@application/use-cases/ReportSyncUseCase'
// import { container } from '@core/di/container'
// import { loggerService } from '@application/services/LoggerService'
// import { SettingsRepository } from '@infrastructure/repositories/SettingsRepository'
import { SyncManager } from '../../api/SyncManager'

// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
const store = {
  isSyncing: false,
  isBackgroundSyncing: false,
  syncProgress: null,
  currentPeriod: '',
  totalLoaded: 0,
  progressPercentage: 0,
  abortSync: () => {},
}

// TODO: Восстановить после реализации SettingsRepository
// const settingsRepository = new SettingsRepository()
const syncManager = new SyncManager()
const financeFetcher = syncManager.getFinanceFetcher()

// Состояние для API ключа
const apiKeyInput = ref('')
const hasApiKey = ref(false)
const apiKeySaveStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// Проверка наличия API ключа при загрузке компонента
async function checkApiKey() {
  try {
    // TODO: Восстановить после реализации SettingsRepository
    // hasApiKey.value = await settingsRepository.hasApiKey()
    const savedKey = localStorage.getItem('wb_api_key')
    hasApiKey.value = !!savedKey
    if (savedKey) {
      syncManager.setApiKey(savedKey)
    }
  } catch (error) {
    console.error('Ошибка при проверке API ключа:', error)
    hasApiKey.value = false
  }
}

// Сохранение API ключа
async function saveApiKey() {
  if (!apiKeyInput.value.trim()) return

  try {
    // TODO: Восстановить после реализации SettingsRepository
    // await settingsRepository.saveApiKey(apiKeyInput.value.trim())
    localStorage.setItem('wb_api_key', apiKeyInput.value.trim())
    syncManager.setApiKey(apiKeyInput.value.trim())
    apiKeySaveStatus.value = { type: 'success', message: 'API ключ успешно сохранен' }
    apiKeyInput.value = '' // Очищаем поле ввода для безопасности
    await checkApiKey() // Обновляем статус наличия ключа
    // TODO: Восстановить после реализации DIContainer
    // container.initialize(await settingsRepository.getApiKey() || '')
  } catch (error: any) {
    apiKeySaveStatus.value = { type: 'error', message: `Ошибка при сохранении: ${error.message}` }
    console.error('Ошибка при сохранении API ключа:', error)
  }

  // Очищаем сообщение через 3 секунды
  setTimeout(() => {
    apiKeySaveStatus.value = null
  }, 3000)
}

// Проверяем наличие API ключа при монтировании компонента
onMounted(() => {
  checkApiKey()
})

// Состояние для загрузки отчетов
const getDefaultDateFrom = () => {
  const date = new Date()
  date.setDate(date.getDate() - 7) // По умолчанию последние 7 дней
  return date.toISOString().split('T')[0]
}

const reportDateFrom = ref<string>(getDefaultDateFrom())
const reportDateTo = ref<string>(new Date().toISOString().split('T')[0])

// Используем реактивные поля из financeFetcher
const isReportSyncing = computed(() => financeFetcher.isFetching.value)
const reportProgress = computed(() => ({
  loaded: financeFetcher.loadedCount.value,
  totalLoaded: financeFetcher.loadedCount.value,
  totalSaved: financeFetcher.loadedCount.value, // Данные сохраняются сразу
  error: financeFetcher.error.value,
  success: !financeFetcher.isFetching.value && !financeFetcher.error.value && financeFetcher.loadedCount.value > 0,
}))

const maxDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

const canLoadReports = computed(() => {
  return reportDateFrom.value && reportDateTo.value && reportDateFrom.value <= reportDateTo.value
})

const canSaveApiKey = computed(() => {
  return apiKeyInput.value && apiKeyInput.value.trim().length > 0
})

// Загрузка отчетов
async function loadReports() {
  if (!canLoadReports.value || isReportSyncing.value) return

  try {
    financeFetcher.reset()
    syncManager.setApiKey(localStorage.getItem('wb_api_key') || '')

    const totalLoaded = await syncManager.startFullSync(
      reportDateFrom.value,
      reportDateTo.value,
      'weekly' // TODO: Добавить выбор периода в UI
    )

    console.log('Загрузка завершена. Всего загружено записей:', totalLoaded)
  } catch (error: any) {
    // Ошибки обрабатываются через financeFetcher.error
    console.error('Ошибка при загрузке отчетов:', error)
  }
}

// TODO: Восстановить после реализации метода startSync в store
// Опции синхронизации
// const syncOptions = ref({
//   includeAdExpenses: false,
// })
// 
// function startSync() {
//   // Существующая логика синхронизации
//   // store.startSync(syncOptions.value)
// }
</script>
