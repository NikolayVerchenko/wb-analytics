import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IWarehouseRemain } from '../../types/db'

/**
 * Fetcher для загрузки остатков на складах
 * Использует асинхронный API: создание задачи -> ожидание -> скачивание
 */
export class StocksFetcher {
  private apiClient: WbApiClient
  private readonly TASK_CHECK_INTERVAL_MS = 5000 // Проверять статус каждые 5 секунд
  private readonly MAX_WAIT_TIME_MS = 120000 // Максимальное время ожидания отчета: 2 минуты

  // Реактивные поля для отслеживания прогресса
  public readonly loadedCount = ref<number>(0)
  public readonly isFetching = ref<boolean>(false)
  public readonly error = ref<string | null>(null)

  constructor(apiClient: WbApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Генерирует Primary Key для записи остатков на складах
   * Формат: ${ni}_${sz} (Артикул WB_Размер)
   */
  private generatePK(ni: number, sz: string): string {
    return `${ni}_${sz}`
  }

  /**
   * Извлекает quantity из массива warehouses по специальному имени
   */
  private getQuantityByWarehouseName(warehouses: any[], name: string): number {
    const warehouse = warehouses.find(w => w.warehouseName === name)
    return warehouse?.quantity || 0
  }

  /**
   * Загружает остатки на складах и сохраняет в БД
   * @returns Общее количество загруженных записей
   */
  async fetchStocks(): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      console.log(`[StocksFetcher] Начало загрузки остатков на складах`)

      // Шаг 1: Создаем задачу на генерацию отчета
      console.log(`[StocksFetcher] Создание задачи на генерацию отчета...`)
      const taskId = await this.apiClient.createStocksTask()
      console.log(`[StocksFetcher] Задача создана, taskId: ${taskId}`)

      // Шаг 2: Ждем готовности отчета
      const startTime = Date.now()
      let status: string
      let checkCount = 0

      console.log(`[StocksFetcher] Ожидание готовности отчета (максимум ${this.MAX_WAIT_TIME_MS / 60000} минуты)...`)
      
      while (true) {
        checkCount++
        // Проверяем статус
        console.log(`[StocksFetcher] Проверка статуса задачи #${checkCount}...`)
        status = await this.apiClient.getStocksStatus(taskId)
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        console.log(`[StocksFetcher] Статус задачи: ${status} (прошло ${elapsed} сек)`)

        if (status === 'done') {
          console.log(`[StocksFetcher] ✅ Отчет готов! (всего проверок: ${checkCount}, время ожидания: ${elapsed} сек)`)
          break
        }

        if (status === 'canceled' || status === 'purged') {
          throw new Error(`Задача отменена или удалена. Статус: ${status}`)
        }

        // Проверяем таймаут
        if (elapsed >= Math.floor(this.MAX_WAIT_TIME_MS / 1000)) {
          throw new Error(`Превышено время ожидания отчета (${this.MAX_WAIT_TIME_MS / 60000} минуты). Последний статус: ${status}`)
        }

        // Ждем перед следующей проверкой
        console.log(`[StocksFetcher] Ожидание ${this.TASK_CHECK_INTERVAL_MS / 1000} секунд перед следующей проверкой...`)
        await new Promise(resolve => setTimeout(resolve, this.TASK_CHECK_INTERVAL_MS))
      }

      // Шаг 3: Скачиваем отчет
      console.log(`[StocksFetcher] 📥 Скачивание отчета...`)
      const rawData = await this.apiClient.downloadStocksReport(taskId)
      console.log(`[StocksFetcher] Отчет скачан, получено ${rawData.length} записей`)

      if (!rawData || rawData.length === 0) {
        console.log(`[StocksFetcher] Данных не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[StocksFetcher] 🔄 Обработка данных...`)

      // Шаг 4: Очищаем старые данные (остатки актуальны только на текущий момент)
      console.log(`[StocksFetcher] Очистка старых данных...`)
      await db.warehouse_remains.clear()

      // Шаг 5: Обрабатываем данные
      const remainsData: IWarehouseRemain[] = []

      for (const item of rawData) {
        const nmId = item.nmId
        const techSize = item.techSize || ''
        const warehouses = item.warehouses || []

        if (!nmId || !techSize) {
          continue
        }

        const pk = this.generatePK(nmId, techSize)

        // Извлекаем quantity для специальных имен
        const q_wh = this.getQuantityByWarehouseName(warehouses, 'Всего находится на складах')
        const q_way_cust = this.getQuantityByWarehouseName(warehouses, 'В пути до получателей')
        const q_way_wh = this.getQuantityByWarehouseName(warehouses, 'В пути возвраты на склад WB')

        // Сохраняем details как JSON.stringify всего массива warehouses
        const details = JSON.stringify(warehouses)

        remainsData.push({
          pk,
          bc: item.brand || '',
          sj: item.subjectName || '',
          sa: item.vendorCode || '',
          ni: nmId,
          sz: techSize,
          q_wh,
          q_way_cust,
          q_way_wh,
          details,
        })
      }

      if (remainsData.length === 0) {
        console.log(`[StocksFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[StocksFetcher] 💾 Сохранение ${remainsData.length} записей в БД...`)

      // Сохраняем в БД
      await db.warehouse_remains.bulkPut(remainsData)

      console.log(`[StocksFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[StocksFetcher]   - Сохранено записей: ${remainsData.length}`)

      this.loadedCount.value = remainsData.length
      this.isFetching.value = false

      return remainsData.length
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке остатков на складах'
      console.error(`[StocksFetcher] ❌ Ошибка при загрузке:`, error.message || error)
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

