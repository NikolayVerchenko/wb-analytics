import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { container } from '@core/di/container'
import type { DateRange } from '@core/services/DateRangeService'

export const useWbStore = defineStore('wb', () => {
  // State
  const isSyncing = ref(false)
  const currentPeriod = ref<string>('')
  const totalLoaded = ref(0)
  const error = ref<string | null>(null)

  // Новые поля для отслеживания состояния синхронизации
  const syncStatus = ref<string>('') // Текст статуса для пользователя: "Загрузка...", "Ожидание лимита...", "Завершено"
  const currentWeek = ref<string>('') // Какая неделя сейчас в обработке
  const retryCount = ref<number>(0) // Сколько раз мы получили 429 для текущего запроса
  
  // Состояние background синхронизации
  const isBackgroundSyncing = ref(false) // Выполняется ли background синхронизация
  const backgroundSyncStatus = ref<string>('') // Статус background синхронизации
  const backgroundRemainingWeeks = ref<number>(0) // Сколько недель осталось загрузить
  const backgroundTotalWeeks = ref<number>(0) // Общее количество исторических недель для загрузки
  const backgroundCurrentWeek = ref<string | undefined>(undefined) // Текущая неделя, которая загружается
  
  // Детальный прогресс для отображения в настройках
  const firstLoadedDate = ref<Date | null>(null) // Самая ранняя загруженная дата (глубина истории)
  const lastLoadedDate = ref<Date | null>(null) // Самая поздняя загруженная дата (актуальность)
  const totalProgressPercentage = ref<number>(0) // Процент выполнения ретро-загрузки (0-100)
  
  // Дата фильтр для сводки (по умолчанию - последние 30 дней)
  // ПЕРЕНЕСЕНО в filterStore.ts

  // Getters
  const progressPercentage = computed(() => {
    return totalProgressPercentage.value
  })

  // Actions
  function setupSyncCallbacks(): void {
    const syncService = container.getReportSyncServiceV2()
    
    syncService.setOnBackgroundStatusChange((isRunning) => {
      isBackgroundSyncing.value = isRunning
      if (isRunning) {
        backgroundSyncStatus.value = 'Загрузка истории...'
        syncStatus.value = 'Загрузка истории...'
      } else {
        backgroundSyncStatus.value = 'Завершено'
        syncStatus.value = isSyncing.value ? 'Загрузка актуальных данных...' : 'Завершено'
        backgroundCurrentWeek.value = undefined
      }
    })

    syncService.setOnTaskStart((task) => {
      if (task.type === 'weekly') {
        backgroundCurrentWeek.value = task.periodId
      }
      currentWeek.value = task.periodId
      syncStatus.value = `Загрузка: ${task.type === 'weekly' ? 'неделя' : 'день'} ${task.periodId}`
      
      // Обновляем прогресс при начале новой задачи (чтобы видеть актуальные данные)
      updateDetailedProgress()
    })
  }

  function initializeServices(): void {
    const apiKey = localStorage.getItem('wb_api_key') || ''
    if (!apiKey) {
      throw new Error('API ключ не найден в localStorage. Укажите его в настройках.')
    }
    container.initialize(apiKey)
    setupSyncCallbacks()
  }

  async function startSync(): Promise<void> {
    const syncService = container.getReportSyncServiceV2()
    
    // При ручном запуске синхронизации приостанавливаем background синхронизацию на 30 секунд
    if (syncService.isBackgroundSyncRunning()) {
      console.log('⏸️ Приостановка background синхронизации на 30 секунд для ручного обновления')
      syncService.pauseBackground(30)
    }

    if (isSyncing.value) {
      console.warn('⚠️ Синхронизация уже выполняется')
      return
    }

    console.log('🚀 Запуск синхронизации данных...')
    try {
      isSyncing.value = true
      error.value = null
      totalLoaded.value = 0
      currentPeriod.value = ''

      // Проверяем наличие API ключа перед началом
      const apiKey = localStorage.getItem('wb_api_key')
      if (!apiKey) {
        throw new Error('API ключ не найден. Пожалуйста, укажите API ключ в настройках перед синхронизацией.')
      }

      // Обновляем контейнер с актуальным ключом
      container.reinitialize(apiKey)
      setupSyncCallbacks()

      // Сбрасываем состояние синхронизации
      syncStatus.value = 'Загрузка...'
      currentWeek.value = ''
      retryCount.value = 0

      // Устанавливаем callback для обработки 429 и сетевых ошибок в API клиенте
      const apiClient = container.getApiClient()
      apiClient.setOnRetryCallback((count: number) => {
        retryCount.value = count
        syncStatus.value = `Временная ошибка. Повтор через 10 сек... (попытка ${count})`
      })

      // Инициализируем проверку запланированных повторов
      await syncService.initializeRetryScheduler()
      
      // Запускаем санитарную проверку базы перед началом
      try {
        const coordinator = container.getSyncCoordinator()
        await coordinator.checkAndFixCorruptedData()
      } catch (err) {
        console.error('Ошибка при выполнении санитарной проверки:', err)
      }

      // Запускаем умную синхронизацию (foreground + background в фоне)
      await syncService.startSync(
        () => isSyncing.value // Callback для проверки, нужно ли продолжать
      )
      
      // Обновляем детальный прогресс
      await updateDetailedProgress()

      if (!isBackgroundSyncing.value) {
        syncStatus.value = 'Завершено'
      } else {
        syncStatus.value = 'Актуальные данные загружены. Идет фоновая загрузка истории...'
      }
      console.log('✅ Foreground синхронизация успешно завершена')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка'
      error.value = errorMessage
      console.error('Ошибка синхронизации:', errorMessage)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  function abortSync(): void {
    const syncService = container.getReportSyncServiceV2()
    syncService.abort()
      isSyncing.value = false
    syncStatus.value = 'Прервано'
      console.log('Синхронизация прервана')
  }

  function setApiKey(apiKey: string): void {
    localStorage.setItem('wb_api_key', apiKey)
    container.reinitialize(apiKey)
    setupSyncCallbacks()
  }

  function getApiKey(): string | null {
    return localStorage.getItem('wb_api_key')
  }

  /**
   * Обновить детальный прогресс синхронизации (для отображения в настройках)
   */
  async function updateDetailedProgress(): Promise<void> {
    try {
      const coordinator = container.getSyncCoordinator()

      // Получаем детальные данные
      const first = await coordinator.getFirstLoadedDate()
      const last = await coordinator.getLastLoadedDate()
      const progress = await coordinator.getTotalProgress()
      const bgStats = await coordinator.getBackgroundSyncStats()

      firstLoadedDate.value = first
      lastLoadedDate.value = last
      totalProgressPercentage.value = progress
      backgroundRemainingWeeks.value = bgStats.remaining
      backgroundCurrentWeek.value = bgStats.currentWeek
      backgroundTotalWeeks.value = bgStats.total
    } catch (error) {
      console.error('Ошибка при обновлении детального прогресса:', error)
    }
  }

  return {
    // State
    isSyncing,
    currentPeriod,
    totalLoaded,
    error,
    syncStatus,
    currentWeek,
    retryCount,
    isBackgroundSyncing,
    backgroundSyncStatus,
    backgroundRemainingWeeks,
    backgroundTotalWeeks,
    backgroundCurrentWeek,
    firstLoadedDate,
    lastLoadedDate,
    totalProgressPercentage,
    // Getters
    progressPercentage,
    // Actions
    startSync,
    abortSync,
    setApiKey,
    getApiKey,
    updateDetailedProgress,
  }
})
