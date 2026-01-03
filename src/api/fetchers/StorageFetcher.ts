import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IStorageCost } from '../../types/db'

/**
 * Fetcher для загрузки стоимости платного хранения товаров
 * Группирует затраты по дате, артикулу и размеру, суммируя стоимость хранения
 */
export class StorageFetcher {
  private apiClient: WbApiClient
  private readonly TASK_CHECK_INTERVAL_MS = 5000 // Проверять статус каждые 5 секунд
  private readonly MAX_WAIT_TIME_MS = 120000 // Максимальное время ожидания отчета: 2 минуты
  private readonly TASK_CREATION_DELAY_MS = 61000 // Задержка между созданием задач: 61 секунда (лимит API: 1 раз в минуту)

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
        return typeof dateStr === 'string' ? dateStr.substring(0, 10) : date.toISOString().split('T')[0]
      }
      return date.toISOString().split('T')[0]
    } catch (error) {
      return typeof dateStr === 'string' ? dateStr.substring(0, 10) : new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Генерирует Primary Key для записи стоимости хранения
   * Формат: ${date}_${nmId}_${size}
   */
  private generatePK(date: string | Date, nmId: number, size: string): string {
    const dt = this.formatDate(date)
    return `${dt}_${nmId}_${size}`
  }

  /**
   * Разбивает период на части максимум по 8 дней (ограничение API)
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Массив периодов [dateFrom, dateTo]
   */
  private splitDateRange(dateFrom: string, dateTo: string): Array<[string, string]> {
    const periods: Array<[string, string]> = []
    let currentFrom = new Date(dateFrom)
    const endDate = new Date(dateTo)
    const maxDays = 8 // Максимальный период для API платного хранения

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
   * Загружает стоимость платного хранения за период и сохраняет в БД
   * Использует асинхронный API: создает задачу, ждет готовности, скачивает отчет
   * Автоматически разбивает период на части по 8 дней (ограничение API)
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Общее количество загруженных записей
   */
  async fetchStorage(dateFrom: string, dateTo: string): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      console.log(`[StorageFetcher] Начало загрузки стоимости хранения за период: ${dateFrom} - ${dateTo}`)

      // Разбиваем период на части по 8 дней (ограничение API)
      const periods = this.splitDateRange(dateFrom, dateTo)
      console.log(`[StorageFetcher] Период разбит на ${periods.length} частей (максимум 8 дней каждая)`)

      let totalSavedRecords = 0

      // Обрабатываем каждый период отдельно
      for (let i = 0; i < periods.length; i++) {
        const [periodFrom, periodTo] = periods[i]
        console.log(`[StorageFetcher] Обработка части ${i + 1}/${periods.length}: ${periodFrom} - ${periodTo}`)

        // Задержка между созданием задач (лимит API: 1 раз в минуту)
        if (i > 0) {
          console.log(`[StorageFetcher] Ожидание 61 секунды перед созданием следующей задачи...`)
          await new Promise(resolve => setTimeout(resolve, this.TASK_CREATION_DELAY_MS))
        }

        // Шаг 1: Создаем задачу на генерацию отчета
        console.log(`[StorageFetcher] Создание задачи на генерацию отчета...`)
        const taskId = await this.apiClient.createStorageTask(periodFrom, periodTo)
        console.log(`[StorageFetcher] Задача создана, taskId: ${taskId}`)

        // Шаг 2: Ждем готовности отчета
        const startTime = Date.now()
        let status: string
        let checkCount = 0

        console.log(`[StorageFetcher] Ожидание готовности отчета (максимум 2 минуты)...`)
        
        while (true) {
          checkCount++
          // Проверяем статус
          console.log(`[StorageFetcher] Проверка статуса задачи #${checkCount}...`)
          status = await this.apiClient.getStorageStatus(taskId)
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          console.log(`[StorageFetcher] Статус задачи: ${status} (прошло ${elapsed} сек)`)

          if (status === 'done') {
            console.log(`[StorageFetcher] ✅ Отчет готов! (всего проверок: ${checkCount}, время ожидания: ${elapsed} сек)`)
            break
          }

          if (status === 'canceled' || status === 'purged') {
            throw new Error(`Задача отменена или удалена. Статус: ${status}`)
          }

          // Проверяем таймаут
          if (elapsed >= Math.floor(this.MAX_WAIT_TIME_MS / 1000)) {
            throw new Error(`Превышено время ожидания отчета (2 минуты). Последний статус: ${status}`)
          }

          // Ждем перед следующей проверкой
          console.log(`[StorageFetcher] Ожидание 5 секунд перед следующей проверкой...`)
          await new Promise(resolve => setTimeout(resolve, this.TASK_CHECK_INTERVAL_MS))
        }

        // Шаг 3: Скачиваем отчет
        console.log(`[StorageFetcher] 📥 Скачивание отчета...`)
        const rawData = await this.apiClient.downloadStorageReport(taskId)
        console.log(`[StorageFetcher] Отчет скачан, получено ${rawData?.length || 0} записей`)

        if (!rawData || rawData.length === 0) {
          console.log(`[StorageFetcher] Часть ${i + 1}/${periods.length}: данных не найдено`)
          continue // Переходим к следующему периоду
        }

        console.log(`[StorageFetcher] Часть ${i + 1}/${periods.length}: получено ${rawData.length} записей из API`)

        // Шаг 4: Группируем и суммируем данные
        // PK = ${date}_${nmId}_${size}
        console.log(`[StorageFetcher] 🔄 Группировка и обработка данных...`)
        const costsMap = new Map<string, IStorageCost>()

        for (const item of rawData) {
          const date = item.date
          const nmId = item.nmId
          const size = item.size || ''
          // warehousePrice может быть отрицательным (скидки), поэтому проверяем на null/undefined отдельно
          const warehousePrice = item.warehousePrice !== null && item.warehousePrice !== undefined ? item.warehousePrice : 0
          const subject = item.subject || ''
          const brand = item.brand || ''
          const vendorCode = item.vendorCode || ''

          // Пропускаем записи с отсутствующими обязательными полями или нулевой стоимостью
          // Отрицательные значения (скидки) сохраняем - они должны суммироваться с положительными
          if (!date || !nmId || size === undefined || warehousePrice === 0) {
            continue
          }

          const pk = this.generatePK(date, nmId, String(size))
          const dt = this.formatDate(date)

          const existing = costsMap.get(pk)
          if (existing) {
            // Суммируем затраты, если запись уже существует (несколько записей за один день по одному артикулу и размеру)
            existing.sc = (existing.sc || 0) + warehousePrice
          } else {
            // Создаем новую запись (берем остальные поля из первой записи)
            costsMap.set(pk, {
              pk,
              dt,
              sj: subject,
              bc: brand,
              sa: vendorCode,
              ni: nmId,
              sz: String(size),
              sc: warehousePrice,
            })
          }
        }

        // Преобразуем Map в массив
        const groupedData = Array.from(costsMap.values())
        console.log(`[StorageFetcher] Группировка завершена: ${rawData.length} исходных записей → ${groupedData.length} уникальных записей`)

        if (groupedData.length > 0) {
          console.log(`[StorageFetcher] 💾 Часть ${i + 1}/${periods.length}: сохранение ${groupedData.length} записей в БД...`)

          // Сохраняем в БД
          // bulkPut автоматически заменяет записи с существующими PK (overwrite)
          await db.storage_costs.bulkPut(groupedData)
          console.log(`[StorageFetcher] ✅ Часть ${i + 1}/${periods.length}: данные сохранены в БД`)
          totalSavedRecords += groupedData.length
          
          // Обновляем счетчик загруженных записей для UI
          this.loadedCount.value = totalSavedRecords
        } else {
          console.log(`[StorageFetcher] ⚠️ Часть ${i + 1}/${periods.length}: после группировки не осталось данных для сохранения`)
        }
      }

      if (totalSavedRecords === 0) {
        console.log(`[StorageFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[StorageFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[StorageFetcher]   - Обработано периодов: ${periods.length}`)
      console.log(`[StorageFetcher]   - Сохранено записей: ${totalSavedRecords}`)

      this.loadedCount.value = totalSavedRecords
      this.isFetching.value = false

      return totalSavedRecords
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке стоимости хранения'
      console.error(`[StorageFetcher] ❌ Ошибка при загрузке:`, error.message || error)
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
