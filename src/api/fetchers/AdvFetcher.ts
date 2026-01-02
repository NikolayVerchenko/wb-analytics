import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IAdvCost } from '../../types/db'

/**
 * Fetcher для загрузки рекламных расходов
 * Группирует расходы по артикулу и дате, суммируя затраты
 */
export class AdvFetcher {
  private apiClient: WbApiClient
  private readonly API_RATE_LIMIT_MS = 300 // 300мс задержка между днями для соблюдения лимита API (1-5 запросов/сек)

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
   * Генерирует Primary Key для записи рекламных расходов
   * Формат: ${nmId}_${date}
   */
  private generatePK(nmId: number, date: string | Date): string {
    const dt = this.formatDate(date)
    return `${nmId}_${dt}`
  }

  /**
   * Генерирует массив дат в диапазоне от dateFrom до dateTo
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Массив дат в формате YYYY-MM-DD
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
   * Задержка для соблюдения лимита API
   */
  private async waitForRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.API_RATE_LIMIT_MS))
  }

  /**
   * Загружает рекламные расходы за период и сохраняет в БД
   * Итерирует по дням, получает историю затрат и информацию о кампаниях,
   * распределяет затраты по артикулам
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @returns Общее количество загруженных записей
   */
  async fetchAds(dateFrom: string, dateTo: string): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      // Генерируем список дат для итерации
      const dates = this.generateDateRange(dateFrom, dateTo)
      
      // Map для группировки затрат по артикулу и дате (pk -> IAdvCost)
      const costsMap = new Map<string, IAdvCost>()

      // Кэш для информации о кампаниях, чтобы не запрашивать повторно
      const campaignsCache = new Map<number, number[]>()

      // Итерируем по каждому дню
      console.log(`[AdvFetcher] Начало загрузки рекламных расходов за период: ${dateFrom} - ${dateTo} (${dates.length} дней)`)
      
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]
        console.log(`[AdvFetcher] Обработка дня ${i + 1}/${dates.length}: ${date}`)

        try {
          // Получаем историю затрат за день
          const history = await this.apiClient.getAdvHistory(date, date)

          if (!history || history.length === 0) {
            console.log(`[AdvFetcher] День ${date}: затрат не найдено`)
            // Если нет затрат за этот день, переходим к следующему
            if (i < dates.length - 1) {
              await this.waitForRateLimit()
            }
            continue
          }

          console.log(`[AdvFetcher] День ${date}: найдено ${history.length} записей о затратах`)

          // Собираем уникальные advertId из истории
          const advertIds = new Set<number>()
          for (const record of history) {
            if (record.advertId) {
              advertIds.add(record.advertId)
            }
          }

          console.log(`[AdvFetcher] День ${date}: найдено ${advertIds.size} уникальных кампаний`)

          // Получаем информацию о кампаниях (только для тех, которых нет в кэше)
          const uncachedIds = Array.from(advertIds).filter(id => !campaignsCache.has(id))
          
          if (uncachedIds.length > 0) {
            console.log(`[AdvFetcher] День ${date}: загрузка информации о ${uncachedIds.length} кампаниях (${uncachedIds.length > 50 ? `разбито на ${Math.ceil(uncachedIds.length / 50)} батчей` : 'один запрос'})`)
            // API ограничивает до 50 ID за запрос, разбиваем на батчи
            const batchSize = 50
            const batches: number[][] = []
            for (let i = 0; i < uncachedIds.length; i += batchSize) {
              batches.push(uncachedIds.slice(i, i + batchSize))
            }

            // Обрабатываем каждый батч
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const batch = batches[batchIndex]
              if (batches.length > 1) {
                console.log(`[AdvFetcher] День ${date}: загрузка батча ${batchIndex + 1}/${batches.length} (${batch.length} кампаний)`)
              }
              
              const campaignsInfo = await this.apiClient.getAdvInfo(batch)
              
              // Сохраняем информацию о кампаниях в кэш
              // Структура ответа: каждая кампания содержит nm_settings - массив объектов с nm_id
              let totalNmIds = 0
              for (const campaign of campaignsInfo) {
                if (campaign.id && campaign.nm_settings) {
                  // Извлекаем nm_id из nm_settings массива
                  const nmIds: number[] = []
                  
                  for (const nmSetting of campaign.nm_settings) {
                    if (nmSetting.nm_id) {
                      nmIds.push(nmSetting.nm_id)
                    }
                  }

                  totalNmIds += nmIds.length
                  campaignsCache.set(campaign.id, nmIds)
                }
              }
              
              if (batches.length > 1) {
                console.log(`[AdvFetcher] День ${date}: батч ${batchIndex + 1} загружен, найдено ${totalNmIds} артикулов`)
              } else {
                console.log(`[AdvFetcher] День ${date}: информация о кампаниях загружена, найдено ${totalNmIds} артикулов`)
              }
              
              // Задержка между батчами (если батчей больше одного)
              if (batches.length > 1 && batchIndex < batches.length - 1) {
                await this.waitForRateLimit()
              }
            }
            
            // Задержка после получения всех кампаний за день
            await this.waitForRateLimit()
          }

          // Распределяем затраты по артикулам
          let processedRecords = 0
          let skippedRecords = 0
          let totalCosts = 0
          
          for (const record of history) {
            const advertId = record.advertId
            if (!advertId) {
              skippedRecords++
              continue
            }

            const nmIds = campaignsCache.get(advertId)
            if (!nmIds || nmIds.length === 0) {
              // Если нет информации о кампании, пропускаем эту запись
              skippedRecords++
              continue
            }

            // Получаем сумму затрат (updSum - сумма в копейках или рублях)
            const costSum = record.updSum || 0
            if (costSum <= 0) {
              skippedRecords++
              continue
            }

            totalCosts += costSum
            processedRecords++

            // Получаем дату списания (updTime в формате ISO или используем date)
            const costDate = record.updTime || date

            // Делим сумму на количество артикулов в кампании
            const costPerNmId = costSum / nmIds.length

            // Для каждого nm_id создаем или обновляем запись
            for (const nmId of nmIds) {
              const pk = this.generatePK(nmId, costDate)
              const dt = this.formatDate(costDate)

              const existing = costsMap.get(pk)
              if (existing) {
                // Суммируем затраты, если запись уже существует
                existing.costs = (existing.costs || 0) + costPerNmId
              } else {
                // Создаем новую запись
                costsMap.set(pk, {
                  pk,
                  dt,
                  ni: nmId,
                  costs: costPerNmId,
                })
              }
            }
          }
          
          console.log(`[AdvFetcher] День ${date}: обработано ${processedRecords} записей, пропущено ${skippedRecords}, сумма затрат: ${totalCosts.toFixed(2)} руб.`)

          // Задержка перед следующим днем
          if (i < dates.length - 1) {
            await this.waitForRateLimit()
          }
        } catch (dayError: any) {
          // Если ошибка при обработке одного дня, логируем и продолжаем
          console.error(`[AdvFetcher] ❌ Ошибка при обработке дня ${date}:`, dayError.message || dayError)
          // Продолжаем обработку следующих дней
        }
      }

      // Преобразуем Map в массив
      const groupedData = Array.from(costsMap.values())

      if (groupedData.length === 0) {
        console.log(`[AdvFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[AdvFetcher] Сохранение ${groupedData.length} записей в БД...`)
      
      // Сохраняем в БД
      // bulkPut автоматически заменяет записи с существующими PK (overwrite)
      await db.adv_costs.bulkPut(groupedData)

      const totalCosts = groupedData.reduce((sum, record) => sum + (record.costs || 0), 0)
      console.log(`[AdvFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[AdvFetcher]   - Обработано дней: ${dates.length}`)
      console.log(`[AdvFetcher]   - Сохранено записей: ${groupedData.length}`)
      console.log(`[AdvFetcher]   - Общая сумма затрат: ${totalCosts.toFixed(2)} руб.`)

      this.loadedCount.value = groupedData.length
      this.isFetching.value = false

      return groupedData.length
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке рекламных расходов'
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

