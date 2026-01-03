import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IProductOrder } from '../../types/db'

/**
 * Fetcher для загрузки статистики заказов (Воронка продаж v3)
 * Загружает данные через POST запрос с пагинацией через offset
 */
export class OrdersStatsFetcher {
  private apiClient: WbApiClient
  private readonly API_RATE_LIMIT_MS = 21000 // 21 секунда между запросами (лимит API: 3 запроса в 20 секунд)
  private readonly PAGE_SIZE = 1000 // Максимальный размер страницы
  private readonly DAY_REQUEST_DELAY_MS = 21000 // Задержка между запросами для разных дней (21 секунда)

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
   * Генерирует Primary Key для записи статистики заказов
   * Формат: ${dt}_${ni} (Дата начала периода_Артикул WB)
   */
  private generatePK(dt: string, ni: number): string {
    return `${dt}_${ni}`
  }

  /**
   * Задержка между запросами для соблюдения лимита API
   */
  private async waitForRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.API_RATE_LIMIT_MS))
  }

  /**
   * Генерирует массив дат между dateFrom и dateTo включительно
   */
  private generateDateRange(dateFrom: string, dateTo: string): string[] {
    const dates: string[] = []
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    
    const current = new Date(start)
    while (current <= end) {
      dates.push(this.formatDate(current))
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }

  /**
   * Загружает статистику заказов за один день с пагинацией
   * @param date Дата (YYYY-MM-DD)
   * @returns Массив записей IProductOrder
   */
  private async fetchOrdersForDay(date: string): Promise<IProductOrder[]> {
    const ordersMap = new Map<string, IProductOrder>()
    let offset = 0
    let pageNumber = 1

    // Пагинация: запрашиваем данные пока products.length > 0
    while (true) {
      console.log(`[OrdersStatsFetcher] День ${date}: запрос страницы ${pageNumber} (offset: ${offset})...`)

      const response = await this.apiClient.fetchOrdersStats(date, date, offset, this.PAGE_SIZE)
      const products = response.products || []

      if (products.length === 0) {
        console.log(`[OrdersStatsFetcher] День ${date}: страница ${pageNumber} - данных не найдено, завершаем пагинацию`)
        break
      }

      console.log(`[OrdersStatsFetcher] День ${date}: страница ${pageNumber} - получено ${products.length} записей`)

      // Обрабатываем каждую запись
      for (const item of products) {
        const product = item.product
        const statistic = item.statistic?.selected

        if (!product || !statistic || !statistic.period) {
          continue
        }

        const dt = this.formatDate(statistic.period.start)
        const ni = product.nmId

        if (!dt || !ni) {
          continue
        }

        const pk = this.generatePK(dt, ni)

        // Создаем или обновляем запись
        // Если запись уже существует (по PK), перезаписываем ее
        ordersMap.set(pk, {
          pk,
          dt,
          ni,
          sa: product.vendorCode || '',
          bc: product.brandName || '',
          sj: product.subjectName || '',
          oc: statistic.orderCount || 0,
          os: statistic.orderSum || 0,
          vsc: statistic.openCount || 0, // переходы в карточку товара
          cc: statistic.cartCount || 0,
          bc_cnt: statistic.buyoutCount || 0,
          bs: statistic.buyoutSum || 0,
          cnc: statistic.cancelCount || 0,
          cns: statistic.cancelSum || 0,
          fav: statistic.addToWishlist || 0,
        })
      }

      // Если получено меньше записей, чем запрашивали, значит это последняя страница
      if (products.length < this.PAGE_SIZE) {
        console.log(`[OrdersStatsFetcher] День ${date}: страница ${pageNumber} - получено меньше записей, чем лимит - это последняя страница`)
        break
      }

      // Переходим к следующей странице
      offset += this.PAGE_SIZE
      pageNumber++

      // Задержка между запросами для соблюдения лимита API (только если есть еще данные)
      if (products.length >= this.PAGE_SIZE) {
        console.log(`[OrdersStatsFetcher] День ${date}: ожидание ${this.API_RATE_LIMIT_MS / 1000} секунд перед следующей страницей...`)
        await this.waitForRateLimit()
      }
    }

    return Array.from(ordersMap.values())
  }

  /**
   * Загружает статистику заказов за период и сохраняет в БД
   * Загружает данные по дням в выбранном диапазоне
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Общее количество загруженных записей
   */
  async fetchOrders(dateFrom: string, dateTo: string): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      console.log(`[OrdersStatsFetcher] Начало загрузки статистики заказов за период: ${dateFrom} - ${dateTo}`)

      // Генерируем массив дат
      const dates = this.generateDateRange(dateFrom, dateTo)
      console.log(`[OrdersStatsFetcher] Будет обработано ${dates.length} дней`)

      const allOrdersMap = new Map<string, IProductOrder>()
      let totalSavedRecords = 0

      // Обрабатываем каждый день
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]
        console.log(`[OrdersStatsFetcher] Обработка дня ${i + 1}/${dates.length}: ${date}`)

        try {
          const dayOrders = await this.fetchOrdersForDay(date)

          if (dayOrders.length > 0) {
            // Добавляем записи в общую Map (перезаписываем дубликаты по PK)
            for (const order of dayOrders) {
              allOrdersMap.set(order.pk, order)
            }

            // Сохраняем данные за день в БД сразу после загрузки
            console.log(`[OrdersStatsFetcher] День ${date}: сохранение ${dayOrders.length} записей в БД...`)
            await db.product_orders.bulkPut(dayOrders)
            totalSavedRecords += dayOrders.length
            
            // Обновляем счетчик загруженных записей для UI
            this.loadedCount.value = totalSavedRecords
            console.log(`[OrdersStatsFetcher] ✅ День ${date}: данные сохранены в БД`)
          } else {
            console.log(`[OrdersStatsFetcher] День ${date}: данных не найдено`)
          }
        } catch (error: any) {
          console.error(`[OrdersStatsFetcher] Ошибка при обработке дня ${date}:`, error.message || error)
          // Продолжаем обработку следующих дней даже при ошибке
          // Можно раскомментировать следующую строку, если нужно прерывать при ошибке:
          // throw error
        }

        // Задержка между днями для соблюдения лимита API (кроме последнего дня)
        if (i < dates.length - 1) {
          console.log(`[OrdersStatsFetcher] Ожидание ${this.DAY_REQUEST_DELAY_MS / 1000} секунд перед следующим днем...`)
          await new Promise(resolve => setTimeout(resolve, this.DAY_REQUEST_DELAY_MS))
        }
      }

      if (totalSavedRecords === 0) {
        console.log(`[OrdersStatsFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[OrdersStatsFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[OrdersStatsFetcher]   - Обработано дней: ${dates.length}`)
      console.log(`[OrdersStatsFetcher]   - Сохранено записей: ${totalSavedRecords}`)

      this.loadedCount.value = totalSavedRecords
      this.isFetching.value = false

      return totalSavedRecords
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке статистики заказов'
      console.error(`[OrdersStatsFetcher] ❌ Ошибка при загрузке:`, error.message || error)
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

