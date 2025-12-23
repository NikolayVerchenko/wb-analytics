import type { WBApiClient } from '@infrastructure/api/wbApiClient'
import type { DataAggregator } from '@infrastructure/aggregators/DataAggregator'
import type { SyncCoordinator, SyncTask } from './SyncCoordinator'
import type { DataPersistenceService } from './DataPersistenceService'
import type { SyncRegistryRepository } from '@infrastructure/repositories/SyncRegistryRepository'
import type { LoggerService } from './LoggerService'
import { toastService } from '@presentation/services/ToastService'

export interface SyncResult {
  success: boolean
  isEmpty: boolean // true если ответ был пустой (данные еще не готовы)
  salesCount: number
  returnsCount: number
  rawRecordsCount: number
  error?: string
}

/**
 * Новая версия сервиса синхронизации с поддержкой Daily/Weekly режимов
 * и обработкой пустых ответов
 */
export class ReportSyncServiceV2 {
  private abortController: AbortController | null = null
  private backgroundAbortController: AbortController | null = null
  private shouldContinueCallback?: () => boolean
  private isBackgroundRunning = false
  private backgroundPausedUntil: number | null = null
  private backgroundStatusCallback?: (isRunning: boolean) => void

  constructor(
    private apiClient: WBApiClient,
    private dataAggregator: DataAggregator,
    private syncCoordinator: SyncCoordinator,
    private dataPersistence: DataPersistenceService,
    private syncRegistry: SyncRegistryRepository,
    private loggerService: LoggerService
  ) {}

  /**
   * Установить callback для уведомления об изменении статуса background синхронизации
   */
  setOnBackgroundStatusChange(callback: (isRunning: boolean) => void): void {
    this.backgroundStatusCallback = callback
  }

  /**
   * Установить callback для уведомления о начале новой задачи
   */
  setOnTaskStart(callback: (task: SyncTask) => void): void {
    this.taskStartCallback = callback
  }

  /**
   * Запустить foreground синхронизацию (приоритетные задачи: сегодня, вчера, текущая неделя)
   * Блокирующая синхронизация - возвращается только после завершения всех foreground задач
   */
  async startForegroundSync(shouldContinue?: () => boolean): Promise<void> {
    this.abortController = new AbortController()
    this.shouldContinueCallback = shouldContinue
    this.isBackgroundRunning = false // Убеждаемся, что это foreground синхронизация

    this.loggerService.add('info', 'Запуск foreground синхронизации (приоритетные данные)')
    console.log('📊 [Sync] Запуск foreground синхронизации: Сегодня, Вчера, Текущая неделя')

    let taskCount = 0

    while (true) {
      // Проверка на прерывание
      if (this.abortController?.signal.aborted) {
        this.loggerService.add('warn', 'Foreground синхронизация прервана пользователем')
        console.log('⚠️ [Sync] Foreground синхронизация прервана пользователем')
        break
      }

      if (this.shouldContinueCallback && !this.shouldContinueCallback()) {
        this.loggerService.add('warn', 'Foreground синхронизация прервана: isSyncing = false')
        console.log('⚠️ [Sync] Foreground синхронизация прервана: isSyncing = false')
        break
      }

      // Получаем следующую foreground задачу
      const task = await this.syncCoordinator.getNextForegroundTask()

      if (!task) {
        this.loggerService.add('info', 'Нет foreground задач для синхронизации')
        console.log('✅ [Sync] Foreground синхронизация завершена. Актуальные данные получены.')
        break
      }

      taskCount++
      console.log(`\n📋 [Sync] Foreground задача #${taskCount}: ${task.type === 'weekly' ? 'Неделя' : 'День'} ${task.periodId}`)

      // Регистрируем задачу как pending
      await this.syncCoordinator.registerTask(task)

      // Выполняем синхронизацию
      const result = await this.syncPeriod(task)

      if (result.success) {
        if (result.isEmpty) {
          // Пустой ответ - помечаем как waiting
          await this.syncCoordinator.markTaskWaiting(task)
          const retryTime = new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          console.log(`⏳ [Sync] Данные за ${task.periodId} еще не готовы. Повтор через 30 минут (в ${retryTime}).`)
        } else {
          // Успешная синхронизация с данными
          const isFinal = task.type === 'weekly' && result.rawRecordsCount > 0
          await this.syncCoordinator.markTaskSuccess(task, isFinal)
          console.log(`✅ [Sync] ${task.periodId} синхронизирован: ${result.rawRecordsCount} строк, ${result.salesCount} продаж, ${result.returnsCount} возвратов`)
          
          // Показываем Toast-уведомление для финального недельного отчета
          if (isFinal && task.type === 'weekly') {
            toastService.success(
              '🎉 Финансовый отчет загружен',
              `Данные за прошлую неделю подтверждены. Неделя ${task.periodId}: получен финальный отчет (${result.rawRecordsCount} записей)`,
              6000
            )
          }
        }
      } else {
        // Ошибка
        await this.syncCoordinator.markTaskFailed(task, result.error || 'Неизвестная ошибка')
        console.error(`❌ [Sync] Ошибка синхронизации ${task.periodId}: ${result.error}`)
      }

      // Для foreground синхронизации НЕ прекращаем цикл при пустом ответе
      // Продолжаем загружать остальные дни текущей недели, даже если сегодняшний день еще не готов
      // Пустой ответ просто помечается как waiting, и мы переходим к следующему дню
      
      // Пауза между задачами
      await this.sleep(2000)
    }

    console.log(`\n🏁 [Sync] Foreground синхронизация завершена. Обработано задач: ${taskCount}`)
  }

  /**
   * Запустить background синхронизацию (ретроспектива: прошлые недели)
   * Неблокирующая синхронизация - запускается в фоне и работает до завершения или прерывания
   * @param onStatusChange Callback для уведомления об изменении статуса (опционально)
   */
  async startBackgroundSync(onStatusChange?: (isRunning: boolean) => void): Promise<void> {
    if (this.isBackgroundRunning) {
      console.log('ℹ️ [Sync] Background синхронизация уже выполняется')
      return
    }

    this.isBackgroundRunning = true
    this.backgroundAbortController = new AbortController()

    // Уведомляем об изменении статуса
    const notifyStatus = (isRunning: boolean) => {
      if (onStatusChange) onStatusChange(isRunning)
      if (this.backgroundStatusCallback) this.backgroundStatusCallback(isRunning)
    }

    notifyStatus(true)
    this.loggerService.add('info', 'Запуск background синхронизации (ретроспектива)')
    console.log('🔄 [Sync] Запуск background синхронизации: загрузка истории (прошлые недели)')

    let taskCount = 0

    try {
      while (true) {
        // Проверка на прерывание
        if (this.backgroundAbortController?.signal.aborted) {
          this.loggerService.add('warn', 'Background синхронизация прервана')
          console.log('⚠️ [Sync] Background синхронизация прервана')
          break
        }

        // Проверка на паузу (для ручного обновления)
        const now = Date.now()
        if (this.backgroundPausedUntil && now < this.backgroundPausedUntil) {
          const remainingSeconds = Math.ceil((this.backgroundPausedUntil - now) / 1000)
          console.log(`⏸️ [Sync] Background синхронизация приостановлена для ручного обновления. Возобновление через ${remainingSeconds} сек.`)
          // Ждем пока пауза не закончится (проверяем каждую секунду)
          await this.sleep(1000)
          continue
        }
        
        // Сбрасываем паузу если она истекла
        if (this.backgroundPausedUntil && now >= this.backgroundPausedUntil) {
          this.backgroundPausedUntil = null
          console.log('▶️ [Sync] Background синхронизация возобновлена после паузы')
        }

        // Получаем следующую background задачу (ретроспектива)
        const task = await this.syncCoordinator.getNextBackgroundTask()

        if (!task) {
          this.loggerService.add('info', 'Нет background задач для синхронизации. История загружена.')
          console.log('✅ [Sync] Background синхронизация завершена. Вся история загружена.')
          break
        }

        taskCount++
        const taskMsg = `Background задача #${taskCount}: Неделя ${task.periodId}`
        console.log(`\n📋 [Sync] ${taskMsg}`)
        this.loggerService.add('info', taskMsg)

        // Регистрируем задачу как pending
        await this.syncCoordinator.registerTask(task)

        // Выполняем синхронизацию
        const result = await this.syncPeriod(task)

        if (result.success) {
          if (result.isEmpty) {
            // Пустой ответ - помечаем как waiting
            await this.syncCoordinator.markTaskWaiting(task)
            const retryTime = new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            console.log(`⏳ [Sync] Данные за ${task.periodId} еще не готовы. Повтор через 30 минут (в ${retryTime}).`)
            // Для background задач с пустым ответом - пропускаем их и продолжаем
            continue
          } else {
            // Успешная синхронизация с данными
            // markTaskSuccess уже вызывается внутри атомарного сохранения (в транзакции)
            const isFinal = task.type === 'weekly' && result.rawRecordsCount > 0
            const successMsg = `${task.periodId} синхронизирован: ${result.rawRecordsCount} строк, ${result.salesCount} продаж`
            console.log(`✅ [Sync] ${successMsg}`)
            this.loggerService.add('success', successMsg)
            
            // Показываем Toast-уведомление для финального недельного отчета
            // Для background синхронизации показываем более тихое уведомление
            if (isFinal && task.type === 'weekly') {
              toastService.success(
                '📊 Неделя загружена',
                `${task.periodId}: ${result.rawRecordsCount} записей`,
                3000
              )
            }
          }
        } else {
          // Ошибка - для background задач продолжаем, но логируем
          await this.syncCoordinator.markTaskFailed(task, result.error || 'Неизвестная ошибка')
          console.error(`❌ [Sync] Ошибка синхронизации ${task.periodId}: ${result.error}`)
          // Продолжаем с другими задачами
        }

        // Пауза между задачами (10 секунд для фоновой загрузки, чтобы не перегружать API)
        await this.sleep(10000)
      }
    } finally {
      this.isBackgroundRunning = false
      
      // Уведомляем об изменении статуса
      if (onStatusChange) onStatusChange(false)
      if (this.backgroundStatusCallback) this.backgroundStatusCallback(false)
      
      console.log(`\n🏁 [Sync] Background синхронизация завершена. Обработано задач: ${taskCount}`)
    }
  }

  /**
   * Запустить синхронизацию с использованием координатора (совместимость со старой логикой)
   * Сначала выполняет foreground синхронизацию, затем запускает background в фоне
   */
  async startSync(shouldContinue?: () => boolean): Promise<void> {
    // Сначала выполняем foreground синхронизацию (блокирующая)
    await this.startForegroundSync(shouldContinue)
    
    // Затем запускаем background синхронизацию (неблокирующая, в фоне)
    // Не ждем её завершения
    this.startBackgroundSync().catch(error => {
      console.error('❌ Ошибка background синхронизации:', error)
    })
  }

  /**
   * Синхронизировать один период (daily или weekly)
   */
  private async syncPeriod(task: SyncTask): Promise<SyncResult> {
    // Уведомляем о начале задачи
    if (this.taskStartCallback) {
      this.taskStartCallback(task)
    }

    const periodDisplay = this.formatPeriodDisplay(task.startDate, task.endDate)
    const typeLabel = task.type === 'weekly' ? 'неделю' : 'день'

    this.loggerService.add('info', `Синхронизация ${typeLabel}: ${task.periodId} (${periodDisplay})`)
    console.log(`🔄 [Sync] Начало синхронизации ${typeLabel} ${task.periodId} (${periodDisplay})`)

    try {
      // Загружаем данные с пагинацией
      console.log(`📥 [Sync] Загрузка данных за ${task.periodId}...`)
      const rawData = await this.loadPeriodDataWithPagination(task.startDate, task.endDate, task)

      // Проверяем, пустой ли ответ
      if (rawData.length === 0) {
        this.loggerService.add('warn', `Пустой ответ для ${task.periodId}. Данные еще не готовы на стороне WB`)
        console.log(`⚠️ [Sync] Пустой ответ для ${task.periodId}. Данные еще не готовы на стороне WB`)
        return {
          success: true,
          isEmpty: true,
          salesCount: 0,
          returnsCount: 0,
          rawRecordsCount: 0,
        }
      }

      console.log(`📊 [Sync] Получено ${rawData.length} записей за ${task.periodId}`)

      // Логируем quantity из сырых данных API (до агрегации)
      let rawSalesQuantity = 0
      let rawActualSalesQuantity = 0 // Фактические штуки (Продажа + Сторно)
      let rawOtherOpsCount = 0 // Количество прочих транзакций
      let rawReturnsQuantity = 0
      let rawSalesWithoutSize = 0
      let rawSalesWithoutSizeQuantity = 0
      const uniqueTsNames = new Set<string>()
      
      for (const item of rawData) {
        const isReturn = item.supplier_oper_name === 'Возврат'
        const isActualSale = item.supplier_oper_name === 'Продажа'
        const isStorno = (item.supplier_oper_name || '').toLowerCase().includes('сторно')
        const quantity = item.quantity || 0
        
        if (isReturn) {
          rawReturnsQuantity += quantity
        } else {
          // Для итогового количества штук считаем только реальные продажи и сторно
          if (isActualSale || isStorno) {
            rawActualSalesQuantity += quantity
          } else {
            rawOtherOpsCount++
          }
          rawSalesQuantity += quantity // Общее quantity из всех строк (для отладки)
          
          if (!item.ts_name || item.ts_name.trim() === '') {
            rawSalesWithoutSize++
            rawSalesWithoutSizeQuantity += quantity
          }
        }

        if (item.ts_name !== undefined && item.ts_name !== null) {
          uniqueTsNames.add(`"${item.ts_name}"`)
        }
      }
      console.log(`📥 [Sync] СЫРЫЕ данные из API: всего записей=${rawData.length}`)
      console.log(`📥 [Sync] СЫРЫЕ данные: ФАКТИЧЕСКИХ ПРОДАЖ (штук) = ${rawActualSalesQuantity}`)
      console.log(`📥 [Sync] СЫРЫЕ данные: ПРОЧИХ ТРАНЗАКЦИЙ (логистика и т.д.) = ${rawOtherOpsCount}`)
      console.log(`📥 [Sync] СЫРЫЕ данные: ВОЗВРАТОВ (штук) = ${rawReturnsQuantity}`)
      
      // Показываем примеры уникальных значений ts_name (первые 20)
      const tsNameExamples = Array.from(uniqueTsNames).slice(0, 20)
      if (tsNameExamples.length > 0) {
        console.log(`📥 [Sync] Примеры значений ts_name из API (первые ${Math.min(20, uniqueTsNames.size)}):`, tsNameExamples)
      }

      // Агрегируем данные
      this.loggerService.add('info', `Агрегирую ${rawData.length} записей...`)
      console.log(`⚙️ [Sync] Агрегирование ${rawData.length} записей...`)
      const { sales, returns } = this.dataAggregator.process(rawData)
      
      // Подсчитываем количество продаж и возвратов как сумму quantity
      const totalSalesQuantityAfterAggregation = sales.reduce((sum, s) => sum + (s.quantity || 0), 0)
      const totalReturnsQuantityAfterAggregation = returns.reduce((sum, r) => sum + (r.quantity || 0), 0)
      console.log(`📈 [Sync] После агрегации: ${sales.length} записей продаж (quantity=${totalSalesQuantityAfterAggregation}), ${returns.length} записей возвратов (quantity=${totalReturnsQuantityAfterAggregation})`)
      
      // Проверяем, не потерялось ли quantity при агрегации
      if (Math.abs(totalSalesQuantityAfterAggregation - rawSalesQuantity) > 0) {
        console.log(`⚠️ [Sync] ВНИМАНИЕ: quantity изменилось при агрегации! Было ${rawSalesQuantity}, стало ${totalSalesQuantityAfterAggregation}, разница=${rawSalesQuantity - totalSalesQuantityAfterAggregation}`)
      }

      // Сохраняем данные атомарно (в транзакции вместе с обновлением sync_registry)
      console.log(`💾 [Sync] Сохранение данных в базу...`)
      
      const isFinal = task.type === 'weekly' && rawData.length > 0
      
      if (task.type === 'weekly') {
        // Weekly: заменяем временные данные на финальные
        // Используем атомарное сохранение с обновлением registry
        await this.dataPersistence.saveDataAtomically(
          sales,
          returns,
          periodDisplay,
          async () => {
            // Callback для обновления sync_registry - выполняется внутри транзакции
            await this.syncCoordinator.markTaskSuccess(task, isFinal)
          },
          {
            isFinal: true,
            startDate: task.startDate,
            endDate: task.endDate,
            deleteTemporaryFirst: true
          }
        )
      } else {
        // Daily: сохраняем как временные данные
        // Используем атомарное сохранение с обновлением registry
        await this.dataPersistence.saveDataAtomically(
          sales,
          returns,
          periodDisplay,
          async () => {
            // Callback для обновления sync_registry - выполняется внутри транзакции
            await this.syncCoordinator.markTaskSuccess(task, false)
          },
          {
            isFinal: false,
            startDate: task.startDate,
            endDate: task.endDate,
            deleteTemporaryFirst: true
          }
        )
      }

      this.loggerService.add('success', `${typeLabel} ${task.periodId} синхронизирована: ${totalSalesQuantityAfterAggregation} продаж (quantity), ${totalReturnsQuantityAfterAggregation} возвратов (quantity)`)
      console.log(`✅ [Sync] Данные сохранены в базу атомарно`)

      return {
        success: true,
        isEmpty: false,
        salesCount: totalSalesQuantityAfterAggregation, // Количество продаж = сумма quantity
        returnsCount: totalReturnsQuantityAfterAggregation, // Количество возвратов = сумма quantity
        rawRecordsCount: rawData.length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.loggerService.add('error', `Ошибка синхронизации ${task.periodId}: ${errorMessage}`)

      return {
        success: false,
        isEmpty: false,
        salesCount: 0,
        returnsCount: 0,
        rawRecordsCount: 0,
        error: errorMessage,
      }
    }
  }

  /**
   * Загрузить данные периода с пагинацией
   */
  private async loadPeriodDataWithPagination(
    startDate: string,
    endDate: string,
    task: SyncTask
  ): Promise<any[]> {
    const allRawData: any[] = []
    let rrdId: number | undefined = undefined
    const MAX_RECORDS_PER_REQUEST = 100000
    let requestCount = 0
    const periodDisplay = this.formatPeriodDisplay(startDate, endDate)

    while (true) {
      // Проверка на прерывание (для background синхронизации используем backgroundAbortController)
      const activeAbortController = this.isBackgroundRunning ? this.backgroundAbortController : this.abortController
      if (activeAbortController?.signal.aborted) {
        throw new Error('Синхронизация прервана')
      }

      // Для background синхронизации не проверяем shouldContinueCallback (она работает независимо)
      if (!this.isBackgroundRunning && this.shouldContinueCallback && !this.shouldContinueCallback()) {
        throw new Error('Синхронизация прервана пользователем')
      }

      requestCount++
      this.loggerService.add('info', `Запрос #${requestCount} данных за период ${periodDisplay}${rrdId ? ` (rrd_id: ${rrdId})` : ''}`)
      console.log(`🌐 [Sync] Запрос #${requestCount} к API за ${periodDisplay}${rrdId ? ` (продолжение с rrd_id: ${rrdId})` : ' (начало)'}`)

      try {
        // Определяем тип периода на основе задачи (daily или weekly)
        const period = task.type === 'daily' ? 'daily' : 'weekly'
        const data = await this.apiClient.getReportDetailByPeriod(startDate, endDate, rrdId, period)
        console.log(`📦 [Sync] Получено ${data?.length || 0} записей в ответе #${requestCount}`)

        if (!data || data.length === 0) {
          // Пустой ответ - возвращаем накопленные данные (может быть пустой массив)
          break
        }

        allRawData.push(...data)
        console.log(`📊 [Sync] Всего загружено записей: ${allRawData.length}`)

        // Проверяем, есть ли еще данные (если получили максимум записей, возможно есть еще)
        if (data.length < MAX_RECORDS_PER_REQUEST) {
          // Получили меньше максимума - значит это последняя страница
          console.log(`✅ [Sync] Загрузка завершена. Всего записей: ${allRawData.length}`)
          break
        }

        // Получаем ID последней записи для следующего запроса
        const lastRecord = data[data.length - 1]
        rrdId = lastRecord?.rrd_id

        if (!rrdId) {
          // Нет rrd_id - значит пагинация невозможна, прекращаем
          console.log(`⚠️ [Sync] Нет rrd_id для продолжения пагинации. Загружено: ${allRawData.length} записей`)
          break
        }
      } catch (error) {
        // Ошибки 429 и сетевые ошибки уже обрабатываются в WbApiService
        // Если дошли сюда, значит это фатальная ошибка
        throw error
      }
    }

    this.loggerService.add('info', `Получено записей: ${allRawData.length} за период ${periodDisplay}`)
    return allRawData
  }

  /**
   * Форматирует период для отображения в UI
   */
  private formatPeriodDisplay(start: string, end: string): string {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const formatDate = (date: Date): string => {
      const day = String(date.getUTCDate()).padStart(2, '0')
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      return `${day}.${month}`
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  /**
   * Прервать синхронизацию (foreground)
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * Прервать background синхронизацию
   */
  abortBackground(): void {
    if (this.backgroundAbortController) {
      this.backgroundAbortController.abort()
      this.isBackgroundRunning = false
    }
  }

  /**
   * Приостановить background синхронизацию на 30 секунд (для ручного обновления)
   */
  pauseBackground(durationSeconds: number = 30): void {
    if (this.isBackgroundRunning) {
      this.backgroundPausedUntil = Date.now() + (durationSeconds * 1000)
      console.log(`⏸️ [Sync] Приостановка background синхронизации на ${durationSeconds} секунд для ручного обновления`)
      this.loggerService.add('info', `Background синхронизация приостановлена на ${durationSeconds} секунд для ручного обновления`)
    }
  }

  /**
   * Проверить, выполняется ли background синхронизация
   */
  isBackgroundSyncRunning(): boolean {
    return this.isBackgroundRunning
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Инициализировать проверку запланированных повторов
   * Вызывается при старте приложения
   */
  async initializeRetryScheduler(): Promise<void> {
    const readyForRetry = await this.syncRegistry.getReadyForRetry()
    
    if (readyForRetry.length > 0) {
      this.loggerService.add('info', `Найдено ${readyForRetry.length} периодов, готовых к повтору`)
      // Эти периоды будут обработаны при следующем вызове startSync()
    }
  }
}
