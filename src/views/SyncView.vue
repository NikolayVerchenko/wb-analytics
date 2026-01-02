<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Загрузка отчетов Wildberries</h1>

      <!-- Поле для API ключа -->
      <div class="mb-6">
        <label for="apiKey" class="block text-sm font-medium text-gray-700 mb-2">
          API ключ Wildberries
        </label>
        <input
          id="apiKey"
          v-model="apiKey"
          type="password"
          placeholder="Введите API ключ"
          class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          @input="saveApiKey"
        />
        <p class="mt-1 text-xs text-gray-500">
          Ключ сохраняется в localStorage
        </p>
      </div>

      <!-- Поля выбора даты -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label for="dateFrom" class="block text-sm font-medium text-gray-700 mb-2">
            Дата начала
          </label>
          <input
            id="dateFrom"
            v-model="dateFrom"
            type="date"
            :max="dateTo"
            class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            :disabled="isLoading"
          />
        </div>
        <div>
          <label for="dateTo" class="block text-sm font-medium text-gray-700 mb-2">
            Дата окончания
          </label>
          <input
            id="dateTo"
            v-model="dateTo"
            type="date"
            :min="dateFrom"
            :max="maxDate"
            class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            :disabled="isLoading"
          />
        </div>
      </div>

      <!-- Переключатель периода -->
      <div class="mb-6">
        <label for="period" class="block text-sm font-medium text-gray-700 mb-2">
          Период отчета
        </label>
        <select
          id="period"
          v-model="period"
          class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          :disabled="isLoading"
        >
          <option value="weekly">Еженедельный</option>
          <option value="daily">Ежедневный</option>
        </select>
      </div>

      <!-- Кнопка загрузки -->
      <button
        @click="startSync"
        :disabled="!canStartSync || isLoading"
        class="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="isLoading" class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Загрузка...
        </span>
        <span v-else>Начать загрузку</span>
      </button>

      <!-- Индикатор прогресса -->
      <div v-if="isLoading" class="mt-6">
        <div class="bg-gray-200 rounded-full h-2.5 mb-2">
          <div
            class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
        <p class="text-sm text-gray-600 text-center">
          Загружено строк: <span class="font-semibold">{{ loadedCount }}</span>
        </p>
      </div>

      <!-- Сообщение об ошибке -->
      <div v-if="error || financeFetcher.error.value" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-800">{{ error || financeFetcher.error.value }}</p>
      </div>

      <!-- Уведомление об успехе -->
      <div v-if="successMessage" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
        <p class="text-sm text-green-800">{{ successMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SyncManager } from '../api/SyncManager'

const apiKey = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const period = ref<'daily' | 'weekly'>('weekly')
const error = ref('')
const successMessage = ref('')

const syncManager = new SyncManager()
const financeFetcher = syncManager.getFinanceFetcher()

// Реактивные поля из fetcher-а
const isLoading = computed(() => financeFetcher.isFetching.value)
const loadedCount = computed(() => financeFetcher.loadedCount.value)

// Максимальная дата - сегодня
const maxDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

// Можно ли начать загрузку
const canStartSync = computed(() => {
  return apiKey.value.trim() !== '' && dateFrom.value !== '' && dateTo.value !== '' && dateFrom.value <= dateTo.value
})

// Процент прогресса (примерный, так как общее количество неизвестно)
const progressPercentage = computed(() => {
  // Показываем прогресс как индикатор активности (пульсирующий)
  return isLoading.value ? 100 : 0
})

// Загрузка API ключа из localStorage
onMounted(() => {
  const savedApiKey = localStorage.getItem('wb_api_key')
  if (savedApiKey) {
    apiKey.value = savedApiKey
    syncManager.setApiKey(savedApiKey)
  }

  // Устанавливаем дефолтные даты (последние 7 дней)
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  dateTo.value = today.toISOString().split('T')[0]
  dateFrom.value = weekAgo.toISOString().split('T')[0]
})

// Сохранение API ключа в localStorage
const saveApiKey = () => {
  localStorage.setItem('wb_api_key', apiKey.value)
  syncManager.setApiKey(apiKey.value)
}

// Начало синхронизации
const startSync = async () => {
  if (!canStartSync.value || isLoading.value) return

  error.value = ''
  successMessage.value = ''
  financeFetcher.reset()

  try {
    syncManager.setApiKey(apiKey.value)

    const totalLoaded = await syncManager.startFullSync(
      dateFrom.value,
      dateTo.value,
      period.value
    )

    // Выводим результат в консоль
    console.log('Загрузка завершена. Всего загружено записей:', totalLoaded)

    successMessage.value = `Загрузка завершена! Загружено ${totalLoaded} записей.`
    
    // Очищаем сообщение об успехе через 5 секунд
    setTimeout(() => {
      successMessage.value = ''
    }, 5000)

  } catch (err: any) {
    error.value = financeFetcher.error.value || err.message || 'Произошла ошибка при загрузке отчетов'
    console.error('Ошибка загрузки:', err)
  }
}
</script>

