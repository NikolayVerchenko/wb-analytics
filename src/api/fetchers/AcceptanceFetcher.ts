import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IAcceptanceCost } from '../../types/db'

/**
 * Fetcher для загрузки стоимости приемки товаров
 * Группирует затраты по артикулу и дате, суммируя стоимость
 */
export class AcceptanceFetcher {
  private apiClient: WbApiClient
  private readonly API_RATE_LIMIT_MS = 61000 // 61 секунда между запросами

  // Реактивные поля для отслеживания прогресса
  public readonly loadedCount = ref<number>(0)
  public readonly isFetching = ref<boolean>(false)
  public readonly error = ref<string | null>(null)

  constructor(apiClient: WbApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Форматирует дату в формат YYYY-MM-DD
   */
  private formatDate(dateStr: string | Date): string {
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
      if (isNaN(date.getTime())) {
        // Если не удалось распарсить, берем первые 10 символов (YYYY-MM-DD)
        return typeof dateStr === 'string' ? dateStr.substring(0, 10) : date.toISOString().split('T')[0]
      }
      return date.toISOString().split('T')[0]
    } catch (error) {
      // В случае ошибки берем первые 10 символов
      return typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Генерирует Primary Key для записи стоимости приемки
   * Формат: ${nmId}_${date}
   */
  private generatePK(nmId: number, date: string | Date): string {
    const dt = this.formatDate(date)
    return `${nmId}_${dt}`
  }

  /**
   * Разбивает период на части максимум по 31 день (ограничение API)
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Массив периодов [dateFrom, dateTo]
   */
  private splitDateRange(dateFrom: string, dateTo: string): Array<[string, string]> {
    const periods: Array<[string, string]> = []
    let currentFrom = new Date(dateFrom)
    const endDate = new Date(dateTo)
    const maxDays = 31 // Максимальный период для API приёмки

    while (currentFrom <= endDate) {
      const currentTo = new Date(currentFrom)
      currentTo.setDate(currentTo.getDate() + maxDays - 1) // -1 потому что включаем начальный день
      
      if (currentTo > endDate) {
        currentTo.setTime(endDate.getTime())
      }

      periods.push([
        this.formatDate(currentFrom),
        this.formatDate(currentTo)
      ])

      currentFrom = new Date(currentTo)
      currentFrom.setDate(currentFrom.getDate() + 1) // Следующий день после окончания текущего периода
    }

    return periods
  }

  /**
   * Загружает стоимость приемки за период и сохраняет в БД
   * Использует асинхронный API: создает задачу, ждет готовности, скачивает отчет
   * Автоматически разбивает период на части по 31 день (ограничение API)
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Общее количество загруженных записей
   */
  async fetchAcceptance(dateFrom: string, dateTo: string): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      console.log(`[AcceptanceFetcher] Начало загрузки стоимости приемки за период: ${dateFrom} - ${dateTo}`)

      // Разбиваем период на части по 31 день
      const periods = this.splitDateRange(dateFrom, dateTo)
      console.log(`[AcceptanceFetcher] Период разбит на ${periods.length} частей (максимум 31 день каждая)`)

      let totalSavedRecords = 0

      // Обрабатываем каждый период отдельно
      for (let i = 0; i < periods.length; i++) {
        const [periodFrom, periodTo] = periods[i]
        console.log(`[AcceptanceFetcher] Обработка части ${i + 1}/${periods.length}: ${periodFrom} - ${periodTo}`)

        // Шаг 1: Создаем задачу на генерацию отчета
        console.log(`[AcceptanceFetcher] Создание задачи на генерацию отчета...`)
        const taskId = await this.apiClient.createAcceptanceTask(periodFrom, periodTo)
        console.log(`[AcceptanceFetcher] Задача создана, taskId: ${taskId}`)

        // Шаг 2: Ждем готовности отчета
        const maxWaitTime = 120000 // 2 минуты в миллисекундах
        const checkInterval = 5000 // 5 секунд между проверками
        const startTime = Date.now()
        let status: string

        console.log(`[AcceptanceFetcher] Ожидание готовности отчета (максимум 2 минуты)...`)
        
        while (true) {
          // Проверяем статус
          status = await this.apiClient.getAcceptanceStatus(taskId)
          console.log(`[AcceptanceFetcher] Статус задачи: ${status}`)

          if (status === 'done') {
            console.log(`[AcceptanceFetcher] Отчет готов!`)
            break
          }

          // Проверяем таймаут
          const elapsed = Date.now() - startTime
          if (elapsed >= maxWaitTime) {
            throw new Error(`Превышено время ожидания отчета (2 минуты). Последний статус: ${status}`)
          }

          // Ждем перед следующей проверкой
          console.log(`[AcceptanceFetcher] Ожидание 5 секунд перед следующей проверкой...`)
          await new Promise(resolve => setTimeout(resolve, checkInterval))
        }

        // Шаг 3: Скачиваем отчет
        console.log(`[AcceptanceFetcher] Скачивание отчета...`)
        const rawData = await this.apiClient.downloadAcceptanceReport(taskId)

        if (!rawData || rawData.length === 0) {
          console.log(`[AcceptanceFetcher] Часть ${i + 1}/${periods.length}: данных не найдено`)
          continue // Переходим к следующему периоду
        }

        console.log(`[AcceptanceFetcher] Часть ${i + 1}/${periods.length}: получено ${rawData.length} записей из API`)

        // Шаг 4: Группируем и суммируем данные
        // PK = ${nmID}_${shkCreateDate}
        const costsMap = new Map<string, IAcceptanceCost>()

        for (const item of rawData) {
          const nmID = item.nmID
          const shkCreateDate = item.shkCreateDate
          const total = item.total || 0

          if (!nmID || !shkCreateDate || total <= 0) {
            continue
          }

          const pk = this.generatePK(nmID, shkCreateDate)
          const dt = this.formatDate(shkCreateDate)

          const existing = costsMap.get(pk)
          if (existing) {
            // Суммируем затраты, если запись уже существует (несколько приемок одного артикула за день)
            existing.costs = (existing.costs || 0) + total
          } else {
            // Создаем новую запись
            costsMap.set(pk, {
              pk,
              dt,
              ni: nmID,
              costs: total,
            })
          }
        }

        // Преобразуем Map в массив
        const groupedData = Array.from(costsMap.values())

        if (groupedData.length > 0) {
          console.log(`[AcceptanceFetcher] Часть ${i + 1}/${periods.length}: сохранение ${groupedData.length} записей в БД...`)

          // Сохраняем в БД
          // bulkPut автоматически заменяет записи с существующими PK (overwrite)
          await db.acceptance_costs.bulkPut(groupedData)
          totalSavedRecords += groupedData.length
        }
      }

      if (totalSavedRecords === 0) {
        console.log(`[AcceptanceFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      const allRecords = await db.acceptance_costs.toArray()
      const totalCosts = allRecords.reduce((sum, record) => sum + (record.costs || 0), 0)
      console.log(`[AcceptanceFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[AcceptanceFetcher]   - Обработано периодов: ${periods.length}`)
      console.log(`[AcceptanceFetcher]   - Сохранено записей: ${totalSavedRecords}`)
      console.log(`[AcceptanceFetcher]   - Общая сумма затрат: ${totalCosts.toFixed(2)} руб.`)

      this.loadedCount.value = totalSavedRecords
      this.isFetching.value = false

      return totalSavedRecords
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке стоимости приемки'
      console.error(`[AcceptanceFetcher] ❌ Ошибка при загрузке:`, error.message || error)
      throw error
    }
  }

  /**
   * Сброс состояния fetcher-а
   */
  reset(): void {
    this.loadedCount.value = 0
    this.isFetching.value = false
    this.error.value = null
  }
}

