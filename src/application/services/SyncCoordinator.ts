import type { DatePeriodService } from '@core/services/DatePeriodService'
import type { SyncRegistryRepository } from '@infrastructure/repositories/SyncRegistryRepository'
import type { DataPersistenceService } from './DataPersistenceService'
import type { LoggerService } from './LoggerService'
import type { SyncType } from '@core/domain/entities/SyncRegistryEntry'
import { db } from '@infrastructure/db/database'

export interface SyncTask {
  periodId: string
  type: SyncType
  startDate: string // RFC3339
  endDate: string // RFC3339
  weekId?: string // Для недель
}

/**
 * Координатор синхронизации - главная логика выбора периода и типа загрузки (Daily/Weekly)
 * Реализует приоритетную логику с разделением на foreground и background синхронизацию:
 * 
 * FOREGROUND (приоритетные, блокирующие):
 * 1. Сегодня и вчера (daily)
 * 2. Текущая неполная неделя (daily)
 * 
 * BACKGROUND (фоновые, ретроспектива):
 * 3. Прошлые недели в обратном порядке (LIFO - от прошлой недели к 29.01.2024)
 */
export class SyncCoordinator {
  constructor(
    private datePeriodService: DatePeriodService,
    private syncRegistry: SyncRegistryRepository,
    private dataPersistence: DataPersistenceService,
    private loggerService: LoggerService
  ) {}

  /**
   * Получить следующую задачу синхронизации по приоритету
   */
  async getNextSyncTask(): Promise<SyncTask | null> {
    // 1. Приоритет: pending или waiting периоды из реестра
    const pendingOrWaiting = await this.syncRegistry.getPendingOrWaiting()
    
    // Проверяем записи, готовые к повтору (nextRetryAt <= now)
    const now = Date.now()
    const readyForRetry = pendingOrWaiting.filter(
      entry => !entry.nextRetryAt || entry.nextRetryAt <= now
    )

    if (readyForRetry.length > 0) {
      // Сортируем по lastAttempt (старые попытки в приоритете)
      readyForRetry.sort((a, b) => a.lastAttempt - b.lastAttempt)
      const nextEntry = readyForRetry[0]
      return await this.createTaskFromRegistryEntry(nextEntry)
    }

    // 2. Приоритет: прошлая неделя (weekly, если не финальная)
    const lastNonFinalWeek = await this.syncRegistry.getLastNonFinalWeek()
    if (lastNonFinalWeek && !lastNonFinalWeek.isFinal) {
      const weeklyTask = await this.createWeeklyTask(lastNonFinalWeek.periodId)
      if (weeklyTask) {
        return weeklyTask
      }
    }

    // 3. Приоритет: текущая неделя (daily)
    const currentWeekId = this.datePeriodService.getCurrentWeekId()
    const currentWeekEntry = await this.syncRegistry.getByPeriod(currentWeekId, 'weekly')
    
    // Если текущая неделя уже финальная, не синхронизируем daily
    if (currentWeekEntry?.isFinal) {
      return null
    }

    // Проверяем, не синхронизируется ли уже текущий день (чтобы избежать дублирования)
    const currentDayId = this.datePeriodService.getCurrentDayId()
    const currentDayEntry = await this.syncRegistry.getByPeriod(currentDayId, 'daily')
    
    // Если текущий день уже существует в реестре, проверяем его статус
    if (currentDayEntry) {
      const now = Date.now()
      // Если статус waiting и nextRetryAt еще не наступил - не создаем новую задачу
      if (currentDayEntry.status === 'waiting' && currentDayEntry.nextRetryAt && currentDayEntry.nextRetryAt > now) {
        // Еще не готов к повтору - не создаем новую задачу
        return null
      }
      // Если статус success - не создаем новую задачу
      if (currentDayEntry.status === 'success') {
        return null
      }
      // Если статус pending - не создаем новую задачу (она уже в обработке)
      if (currentDayEntry.status === 'pending') {
        return null
      }
    }

    // Создаем daily задачу для текущего дня
    return await this.getDailyTaskForDay(0)
  }

  /**
   * Получить следующую задачу для foreground синхронизации (приоритетные задачи)
   * Приоритеты:
   * 1. Pending/waiting периоды из реестра (готовые к повтору) - ТОЛЬКО для daily задач текущей недели
   * 2. Дни текущей недели (от понедельника до сегодня) в обратном порядке (сегодня, вчера, позавчера...)
   */
  async getNextForegroundTask(): Promise<SyncTask | null> {
    const now = Date.now()
    const currentWeekId = this.datePeriodService.getCurrentWeekId()
    const currentWeekStart = this.getCurrentWeekStart()
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    
    // 1. Приоритет: pending/waiting периоды из реестра (готовые к повтору)
    // НО только для daily задач текущей недели
    const pendingOrWaiting = await this.syncRegistry.getPendingOrWaiting()
    const readyForRetry = pendingOrWaiting.filter(
      entry => {
        // Фильтруем только те, что готовы к повтору
        if (entry.nextRetryAt && entry.nextRetryAt > now) {
          return false
        }
        // Для foreground берем только daily задачи текущей недели
        if (entry.type === 'daily') {
          const entryDate = new Date(entry.periodId + 'T00:00:00Z')
          // Проверяем, что дата входит в текущую неделю (от понедельника до сегодня)
          return entryDate >= currentWeekStart && entryDate <= today
        }
        // Weekly задачи для foreground НЕ берем (они в background)
        return false
      }
    )

    if (readyForRetry.length > 0) {
      // Сортируем по lastAttempt (старые попытки в приоритете)
      readyForRetry.sort((a, b) => a.lastAttempt - b.lastAttempt)
      const nextEntry = readyForRetry[0]
      return await this.createTaskFromRegistryEntry(nextEntry)
    }

    // 2. Приоритет: Дни текущей недели от сегодня назад к понедельнику
    // Проверяем текущую неделю - если она уже финальная, не синхронизируем daily
    const currentWeekEntry = await this.syncRegistry.getByPeriod(currentWeekId, 'weekly')
    if (currentWeekEntry?.isFinal) {
      return null
    }

    // Идем от сегодня назад к началу недели
    const currentDate = new Date(today)
    while (currentDate >= currentWeekStart) {
      const dayTask = await this.getDailyTaskForDate(currentDate)
      if (dayTask) {
        return dayTask
      }
      // Переходим к предыдущему дню
      currentDate.setUTCDate(currentDate.getUTCDate() - 1)
    }

    return null
  }

  /**
   * Получить дату начала текущей недели (понедельник)
   */
  private getCurrentWeekStart(): Date {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const dayOfWeek = today.getUTCDay() // 0 = воскресенье, 1 = понедельник, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Если воскресенье, то -6 дней
    const weekStart = new Date(today)
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday)
    return weekStart
  }

  /**
   * Получить задачу для конкретной даты
   */
  private async getDailyTaskForDate(targetDate: Date): Promise<SyncTask | null> {
    const dayId = this.datePeriodService.getDayId(targetDate)
    const dayEntry = await this.syncRegistry.getByPeriod(dayId, 'daily')
    
    // Проверяем статус существующей записи
    if (dayEntry) {
      const now = Date.now()
      // Если статус waiting и nextRetryAt еще не наступил - не создаем новую задачу
      if (dayEntry.status === 'waiting' && dayEntry.nextRetryAt && dayEntry.nextRetryAt > now) {
        return null
      }
      // Если статус success или pending - не создаем новую задачу
      if (dayEntry.status === 'success' || dayEntry.status === 'pending') {
        return null
      }
    }

    const start = targetDate.toISOString()
    const end = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString()
    
    return {
      periodId: dayId,
      type: 'daily',
      startDate: start,
      endDate: end,
    }
  }

  /**
   * Получить следующую задачу для background синхронизации (ретроспектива)
   * Возвращает задачи для прошлых недель в обратном порядке (LIFO)
   */
  async getNextBackgroundTask(): Promise<SyncTask | null> {
    // Находим самую недавнюю неделю, которая еще не синхронизирована
    // Сначала пробуем прошлую неделю
    const lastWeekId = this.datePeriodService.getLastWeekId()
    const lastWeekEntry = await this.syncRegistry.getByPeriod(lastWeekId, 'weekly')
    
    // Если прошлая неделя не финальная и не успешно синхронизирована - возвращаем её
    if (!lastWeekEntry || (!lastWeekEntry.isFinal && lastWeekEntry.status !== 'success')) {
      const task = await this.createWeeklyTask(lastWeekId)
      if (task) {
        return task
      }
    }

    // Ищем другие не синхронизированные недели, начиная от прошлой недели назад
    const allWeeks = await this.getAllWeeksFromPastToMinDate()
    
    // Сортируем в обратном порядке (от недавних к старым) для LIFO
    allWeeks.reverse()
    
    for (const weekId of allWeeks) {
      const entry = await this.syncRegistry.getByPeriod(weekId, 'weekly')
      
      // Пропускаем финальные недели и успешно синхронизированные
      if (entry?.isFinal || entry?.status === 'success') {
        continue
      }
      
      // Пропускаем текущую неделю (она обрабатывается в foreground)
      const currentWeekId = this.datePeriodService.getCurrentWeekId()
      if (weekId === currentWeekId) {
        continue
      }
      
      const task = await this.createWeeklyTask(weekId)
      if (task) {
        return task
      }
    }

    return null
  }

  /**
   * Получить задачу для дня (относительно сегодня)
   * @param daysOffset 0 = сегодня, -1 = вчера, -2 = позавчера и т.д.
   */
  private async getDailyTaskForDay(daysOffset: number): Promise<SyncTask | null> {
    const targetDate = new Date()
    targetDate.setUTCDate(targetDate.getUTCDate() + daysOffset)
    targetDate.setUTCHours(0, 0, 0, 0)
    
    const dayId = this.datePeriodService.getDayId(targetDate)
    const dayEntry = await this.syncRegistry.getByPeriod(dayId, 'daily')
    
    // Проверяем статус существующей записи
    if (dayEntry) {
      const now = Date.now()
      // Если статус waiting и nextRetryAt еще не наступил - не создаем новую задачу
      if (dayEntry.status === 'waiting' && dayEntry.nextRetryAt && dayEntry.nextRetryAt > now) {
        return null
      }
      // Если статус success или pending - не создаем новую задачу
      if (dayEntry.status === 'success' || dayEntry.status === 'pending') {
        return null
      }
    }

    // Форматируем дату в RFC3339 с московским временем (UTC+3)
    // Начало дня - только дата, конец дня - с временем 23:59:59
    const start = this.formatToMoscowTime(targetDate, false)
    const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1000)
    const end = this.formatToMoscowTime(endDate, true)
    
    return {
      periodId: dayId,
      type: 'daily',
      startDate: start,
      endDate: end,
    }
  }

  /**
   * Получить список всех недель от прошлой недели до минимальной даты
   */
  private async getAllWeeksFromPastToMinDate(): Promise<string[]> {
    const lastWeekId = this.datePeriodService.getLastWeekId()
    const minDate = new Date('2024-01-29T00:00:00Z')
    const lastWeekDate = new Date()
    lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7)
    
    const periods = this.datePeriodService.generateWeeklyPeriodsBetween(minDate, lastWeekDate)
    return periods.map(p => p.weekId)
  }

  /**
   * Создать задачу из записи реестра
   */
  private async createTaskFromRegistryEntry(entry: import('@core/domain/entities/SyncRegistryEntry').SyncRegistryEntry): Promise<SyncTask | null> {
    if (entry.type === 'weekly') {
      return await this.createWeeklyTask(entry.periodId)
    } else {
      // daily: periodId должен быть в формате YYYY-MM-DD
      const date = new Date(entry.periodId + 'T00:00:00Z')
      const start = this.formatToMoscowTime(date, false)
      const endDate = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1000)
      const end = this.formatToMoscowTime(endDate, true)
      
      return {
        periodId: entry.periodId,
        type: 'daily',
        startDate: start,
        endDate: end,
      }
    }
  }

  /**
   * Создать weekly задачу для недели
   * Использует DatePeriodService для генерации периода по weekId
   */
  private async createWeeklyTask(weekId: string): Promise<SyncTask | null> {
    // Парсим weekId (формат: "2024-W45")
    const match = weekId.match(/^(\d{4})-W(\d{2})$/)
    if (!match) {
      this.loggerService.add('error', `Неверный формат weekId: ${weekId}`)
      return null
    }

    const year = parseInt(match[1])
    
    // Генерируем периоды для нужного года, чтобы найти нужную неделю
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    
    const periods = this.datePeriodService.generateWeeklyPeriodsBetween(yearStart, yearEnd)
    const targetPeriod = periods.find(p => p.weekId === weekId)
    
    if (!targetPeriod) {
      this.loggerService.add('error', `Не удалось найти период для weekId: ${weekId}`)
      return null
    }

    return {
      periodId: weekId,
      type: 'weekly',
      startDate: targetPeriod.start,
      endDate: targetPeriod.end,
      weekId,
    }
  }


  /**
   * Отметить задачу как успешно выполненную
   */
  async markTaskSuccess(task: SyncTask, isFinal: boolean = false): Promise<void> {
    await this.syncRegistry.upsert({
      periodId: task.periodId,
      type: task.type,
      status: 'success',
      lastAttempt: Date.now(),
      isFinal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    if (isFinal && task.type === 'weekly') {
      await this.syncRegistry.setFinal(task.periodId, 'weekly')
      this.loggerService.add('success', `Период ${task.periodId} отмечен как финальный`)
    }
  }

  /**
   * Отметить задачу как ожидающую данных (пустой ответ от API)
   */
  async markTaskWaiting(task: SyncTask): Promise<void> {
    const nextRetryAt = Date.now() + 30 * 60 * 1000 // 30 минут

    await this.syncRegistry.upsert({
      periodId: task.periodId,
      type: task.type,
      status: 'waiting',
      lastAttempt: Date.now(),
      nextRetryAt,
      isFinal: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const retryTime = new Date(nextRetryAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const periodLabel = this.formatPeriodForLog(task.periodId)
    this.loggerService.add('warn', `Период ${periodLabel}: WB ответил пустым списком. Следующая попытка запланирована на ${retryTime}`)
  }

  /**
   * Форматирует дату в RFC3339 для daily задач
   * API Wildberries принимает даты в часовом поясе Москва (UTC+3)
   * Для daily: начало дня передаем как дату, конец дня - с временем 23:59:59+03:00
   */
  private formatToMoscowTime(date: Date, isEndOfDay: boolean = false): string {
    // Нормализуем дату к началу дня в UTC
    const normalizedDate = new Date(date)
    normalizedDate.setUTCHours(0, 0, 0, 0)
    
    const year = normalizedDate.getUTCFullYear()
    const month = String(normalizedDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(normalizedDate.getUTCDate()).padStart(2, '0')
    
    if (isEndOfDay) {
      // Конец дня: дата с временем 23:59:59+03:00
      // API интерпретирует это как конец дня в московском времени
      return `${year}-${month}-${day}T23:59:59+03:00`
    } else {
      // Начало дня: только дата (API интерпретирует как начало дня в московском времени)
      return `${year}-${month}-${day}`
    }
  }

  /**
   * Форматирует periodId для логов
   */
  private formatPeriodForLog(periodId: string): string {
    // Если это дата в формате YYYY-MM-DD, форматируем как DD.MM
    const dateMatch = periodId.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateMatch) {
      return `${dateMatch[3]}.${dateMatch[2]}`
    }
    return periodId
  }

  /**
   * Отметить задачу как failed
   */
  async markTaskFailed(task: SyncTask, errorMessage: string): Promise<void> {
    await this.syncRegistry.upsert({
      periodId: task.periodId,
      type: task.type,
      status: 'failed',
      lastAttempt: Date.now(),
      isFinal: false,
      errorMessage,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    this.loggerService.add('error', `Ошибка синхронизации ${task.periodId}: ${errorMessage}`)
  }

  /**
   * Зарегистрировать задачу как pending (перед началом синхронизации)
   */
  async registerTask(task: SyncTask): Promise<void> {
    const existing = await this.syncRegistry.getByPeriod(task.periodId, task.type)
    
    if (!existing) {
      await this.syncRegistry.upsert({
        periodId: task.periodId,
        type: task.type,
        status: 'pending',
        lastAttempt: Date.now(),
        isFinal: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  /**
   * Проверить, является ли это первым запуском (пустая база)
   * Проверяет и sync_registry, и наличие реальных данных продаж/возвратов
   */
  async isFirstRun(): Promise<boolean> {
    const allEntries = await this.syncRegistry.getAll()
    
    // Если реестр пуст, точно первый запуск
    if (allEntries.length === 0) {
      return true
    }
    
    // Проверяем наличие реальных данных
    // Если в реестре есть записи, но данных нет - это тоже первый запуск (данные могли быть очищены)
    const hasData = await this.dataPersistence.hasAnyData()
    return !hasData
  }

  /**
   * Генерировать начальную очередь синхронизации (все недели от начальной даты)
   * @param fromDate Начальная дата (по умолчанию 2024-01-29)
   * @param toDate Конечная дата (по умолчанию текущая дата)
   * @returns Количество созданных задач
   */
  async generateInitialSyncQueue(fromDate?: Date, toDate?: Date): Promise<number> {
    const startDate = fromDate || new Date('2024-01-29T00:00:00Z')
    const endDate = toDate || new Date()

    // Генерируем все недели от начальной даты до текущей
    const periods = this.datePeriodService.generateWeeklyPeriodsBetween(startDate, endDate)

    let createdCount = 0
    const now = Date.now()

    for (const period of periods) {
      // Проверяем, существует ли уже запись для этой недели
      const existing = await this.syncRegistry.getByPeriod(period.weekId, 'weekly')
      
      if (!existing) {
        await this.syncRegistry.upsert({
          periodId: period.weekId,
          type: 'weekly',
          status: 'pending',
          lastAttempt: now,
          isFinal: false,
          createdAt: now,
          updatedAt: now,
        })
        createdCount++
      }
    }

    this.loggerService.add('info', `Создана начальная очередь синхронизации: ${createdCount} недель (от ${this.formatDateForLog(startDate)} до ${this.formatDateForLog(endDate)})`)
    
    return createdCount
  }

  /**
   * Генерировать очередь только для последних N недель (быстрый старт)
   * @param weeksCount Количество последних недель (по умолчанию 2)
   * @returns Количество созданных задач
   */
  async generateLastWeeksQueue(weeksCount: number = 2): Promise<number> {
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setUTCDate(startDate.getUTCDate() - (weeksCount * 7))

    // Используем минимальную дату как нижнюю границу
    const minDate = new Date('2024-01-29T00:00:00Z')
    const actualStartDate = startDate < minDate ? minDate : startDate

    return await this.generateInitialSyncQueue(actualStartDate, endDate)
  }

  /**
   * Проверить базу на наличие старых "раздутых" данных (мусор логистики)
   * и исправить их, сбросив статус в реестре для пересинхронизации
   */
  async checkAndFixCorruptedData(): Promise<number> {
    this.loggerService.add('info', 'Запуск санитарной проверки базы данных...')
    
    // 1. Находим записи с аномально высоким quantity без размера (это 100% старый мусор)
    const corruptedSales = await db.sales
      .filter(s => (s.quantity || 0) > 100 && (!s.ts_name || s.ts_name.trim() === ''))
      .toArray()

    if (corruptedSales.length === 0) {
      this.loggerService.add('info', 'Санитарная проверка: аномалий не обнаружено')
      return 0
    }

    this.loggerService.add('warn', `Найдено ${corruptedSales.length} аномальных записей. Запуск очистки...`)

    // 2. Определяем периоды (недели), которые нужно пересинхронизировать
    const weekIdsToFix = new Set<string>()
    for (const sale of corruptedSales) {
      const date = new Date(sale.rr_dt.split('T')[0] + 'T00:00:00Z')
      try {
        const weekId = this.datePeriodService.getWeekId(date)
        weekIdsToFix.add(weekId)
      } catch (e) {
        // Игнорируем ошибки определения недели
      }
    }

    // 3. Для каждой проблемной недели: удаляем данные и сбрасываем статус в реестре
    let fixedCount = 0
    for (const weekId of weekIdsToFix) {
      // Получаем границы недели
      const task = await this.createWeeklyTask(weekId)
      if (task) {
        // Удаляем ВСЕ данные за этот период (теперь с исправленным deleteAllDataForPeriod)
        await this.dataPersistence.deleteAllDataForPeriod(task.startDate, task.endDate)
        
        // Сбрасываем статус в реестре на pending
        await this.syncRegistry.updateStatus(weekId, 'weekly', 'pending')
        fixedCount++
        this.loggerService.add('info', `Неделя ${weekId} очищена и поставлена в очередь на пересинхронизацию`)
      }
    }

    this.loggerService.add('success', `Санитарная очистка завершена. Исправлено недель: ${fixedCount}`)
    return fixedCount
  }

  /**
   * Форматирует дату для логов
   */
  private formatDateForLog(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}.${month}.${year}`
  }

  /**
   * Получить статистику синхронизации для отображения прогресса
   */
  async getSyncStats(): Promise<{ total: number; pending: number; success: number; waiting: number; failed: number }> {
    const allEntries = await this.syncRegistry.getAll()
    
    return {
      total: allEntries.length,
      pending: allEntries.filter(e => e.status === 'pending').length,
      success: allEntries.filter(e => e.status === 'success').length,
      waiting: allEntries.filter(e => e.status === 'waiting').length,
      failed: allEntries.filter(e => e.status === 'failed').length,
    }
  }

  /**
   * Восстановить незавершенные задачи (recovery после прерывания сессии)
   * Возвращает все задачи со статусом, отличным от success, и сбрасывает их в pending
   */
  async recover(): Promise<number> {
    const incompleteTasks = await this.syncRegistry.getAllNonSuccess()
    
    if (incompleteTasks.length === 0) {
      this.loggerService.add('info', 'Восстановление: нет незавершенных задач')
      return 0
    }

    this.loggerService.add('info', `Восстановление: найдено ${incompleteTasks.length} незавершенных задач`)
    console.log(`🔄 [Recovery] Найдено ${incompleteTasks.length} незавершенных задач. Возвращаем их в очередь...`)

    // Сбрасываем статус на pending для всех незавершенных задач
    let recoveredCount = 0
    for (const task of incompleteTasks) {
      await this.syncRegistry.updateStatus(
        task.periodId,
        task.type,
        'pending',
        undefined, // Сбрасываем nextRetryAt
        undefined  // Очищаем errorMessage
      )
      recoveredCount++
    }

    this.loggerService.add('success', `Восстановление: ${recoveredCount} задач возвращено в очередь`)
    console.log(`✅ [Recovery] ${recoveredCount} задач восстановлено и возвращено в очередь синхронизации`)

    return recoveredCount
  }

  /**
   * Получить статистику фоновой синхронизации (сколько недель осталось загрузить)
   */
  async getBackgroundSyncStats(): Promise<{ remaining: number; total: number; currentWeek?: string }> {
    const allWeeks = await this.getAllWeeksFromPastToMinDate()
    const currentWeekId = this.datePeriodService.getCurrentWeekId()
    
    // Фильтруем недели: исключаем текущую
    const historicalWeeks = allWeeks.filter(weekId => weekId !== currentWeekId)
    const totalHistoricalWeeks = historicalWeeks.length
    
    // Фильтруем недели: исключаем финальные/успешно синхронизированные
    let remaining = 0
    let currentWeek: string | undefined

    for (const weekId of historicalWeeks.reverse()) { // LIFO порядок
      const entry = await this.syncRegistry.getByPeriod(weekId, 'weekly')
      
      // Считаем только те недели, которые не финальные и не успешно синхронизированы
      if (!entry?.isFinal && entry?.status !== 'success') {
        if (!currentWeek) {
          currentWeek = weekId
        }
        remaining++
      }
    }

    return { remaining, total: totalHistoricalWeeks, currentWeek }
  }

  /**
   * Получить самую раннюю дату загруженных данных (глубина истории)
   */
  async getFirstLoadedDate(): Promise<Date | null> {
    const allEntries = await this.syncRegistry.getAll()
    const successEntries = allEntries.filter(e => e.status === 'success')
    
    if (successEntries.length === 0) {
      return null
    }

    // Для daily периодов periodId = YYYY-MM-DD
    // Для weekly периодов periodId = YYYY-WNN
    const dates: Date[] = []
    
    for (const entry of successEntries) {
      if (entry.type === 'daily') {
        // Парсим YYYY-MM-DD
        const date = new Date(entry.periodId + 'T00:00:00Z')
        if (!isNaN(date.getTime())) {
          dates.push(date)
        }
      } else if (entry.type === 'weekly') {
        // Парсим YYYY-WNN и получаем начало недели
        try {
          const weekStart = this.datePeriodService.getWeekStartDate(entry.periodId)
          if (weekStart) {
            dates.push(weekStart)
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
    }

    if (dates.length === 0) {
      return null
    }

    return new Date(Math.min(...dates.map(d => d.getTime())))
  }

  /**
   * Получить самую позднюю дату загруженных данных (актуальность)
   */
  async getLastLoadedDate(): Promise<Date | null> {
    const allEntries = await this.syncRegistry.getAll()
    const successEntries = allEntries.filter(e => e.status === 'success')
    
    if (successEntries.length === 0) {
      return null
    }

    const dates: Date[] = []
    
    for (const entry of successEntries) {
      if (entry.type === 'daily') {
        // Парсим YYYY-MM-DD
        const date = new Date(entry.periodId + 'T23:59:59Z')
        if (!isNaN(date.getTime())) {
          dates.push(date)
        }
      } else if (entry.type === 'weekly') {
        // Парсим YYYY-WNN и получаем конец недели
        try {
          const weekStart = this.datePeriodService.getWeekStartDate(entry.periodId)
          if (weekStart) {
            // Конец недели = начало + 6 дней
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            weekEnd.setHours(23, 59, 59, 999)
            dates.push(weekEnd)
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
    }

    if (dates.length === 0) {
      return null
    }

    return new Date(Math.max(...dates.map(d => d.getTime())))
  }

  /**
   * Получить процент выполнения ретро-загрузки (от начала времен до текущей недели)
   */
  async getTotalProgress(): Promise<number> {
    const MIN_DATE = new Date('2024-01-29T00:00:00Z')
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const totalDays = Math.ceil((today.getTime() - MIN_DATE.getTime()) / (1000 * 60 * 60 * 24))
    
    const allWeeks = await this.getAllWeeksFromPastToMinDate()
    const currentWeekId = this.datePeriodService.getCurrentWeekId()
    
    // Считаем успешно загруженные недели (исключая текущую)
    let loadedWeeks = 0
    for (const weekId of allWeeks) {
      if (weekId === currentWeekId) {
        continue
      }

      const entry = await this.syncRegistry.getByPeriod(weekId, 'weekly')
      if (entry?.status === 'success' || entry?.isFinal) {
        loadedWeeks++
      }
    }

    // Приблизительная оценка: каждая неделя = 7 дней
    const loadedDays = loadedWeeks * 7
    const progress = Math.min(100, Math.max(0, (loadedDays / totalDays) * 100))

    return Math.round(progress)
  }

  /**
   * Получить все успешно загруженные периоды для визуализации таймлайна
   */
  async getLoadedPeriods(): Promise<Array<{ start: Date; end: Date; type: 'daily' | 'weekly' }>> {
    const allEntries = await this.syncRegistry.getAll()
    const successEntries = allEntries.filter(e => e.status === 'success' || e.isFinal)
    
    const periods: Array<{ start: Date; end: Date; type: 'daily' | 'weekly' }> = []
    
    for (const entry of successEntries) {
      if (entry.type === 'daily') {
        // Парсим YYYY-MM-DD
        const date = new Date(entry.periodId + 'T00:00:00Z')
        if (!isNaN(date.getTime())) {
          const end = new Date(date)
          end.setHours(23, 59, 59, 999)
          periods.push({ start: date, end, type: 'daily' })
        }
      } else if (entry.type === 'weekly') {
        // Парсим YYYY-WNN и получаем начало и конец недели
        try {
          const weekStart = this.datePeriodService.getWeekStartDate(entry.periodId)
          if (weekStart) {
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            weekEnd.setHours(23, 59, 59, 999)
            periods.push({ start: weekStart, end: weekEnd, type: 'weekly' })
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
    }

    return periods
  }
}
