import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { ISale, IReturn, ILogistics, IPenalty, IDeduction, WBReportRow } from '../../types/db'

/**
 * Fetcher для загрузки финансовых отчетов с пагинацией
 * Распределяет данные по 5 независимым таблицам БД
 */
export class FinanceFetcher {
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
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        // Если не удалось распарсить, берем первые 10 символов (YYYY-MM-DD)
        return dateStr.substring(0, 10)
      }
      return date.toISOString().split('T')[0]
    } catch (error) {
      // В случае ошибки берем первые 10 символов
      return dateStr.substring(0, 10)
    }
  }

  /**
   * Генерирует Primary Key для записи (без rrd_id для группировки)
   * Формат: nm_id_rr_dt_ts_name
   */
  private generatePK(item: WBReportRow): string {
    const dt = this.formatDate(item.rr_dt)
    return `${item.nm_id}_${dt}_${item.ts_name || ''}`
  }

  /**
   * Преобразует запись API в запись для таблицы продаж
   */
  private mapToSale(item: WBReportRow): ISale {
    return {
      pk: this.generatePK(item),
      dt: this.formatDate(item.rr_dt),
      ni: item.nm_id,
      sa: item.sa_name,
      bc: item.brand_name,
      sj: item.subject_name,
      sz: item.ts_name,
      qt: item.quantity || 0,
      pv: item.retail_price || 0,
      pa: item.retail_amount || 0,
      pz: item.ppvz_for_pay || 0,
      gi_id: item.gi_id,
    }
  }

  /**
   * Преобразует запись API в запись для таблицы возвратов
   */
  private mapToReturn(item: WBReportRow): IReturn {
    return {
      pk: this.generatePK(item),
      dt: this.formatDate(item.rr_dt),
      ni: item.nm_id,
      sa: item.sa_name,
      bc: item.brand_name,
      sj: item.subject_name,
      sz: item.ts_name,
      qt: item.quantity || 0,
      pv: item.retail_price || 0,
      pa: item.retail_amount || 0,
      pz: item.ppvz_for_pay || 0,
    }
  }

  /**
   * Преобразует запись API в запись для таблицы логистики
   */
  private mapToLogistics(item: WBReportRow): ILogistics {
    return {
      pk: this.generatePK(item),
      dt: this.formatDate(item.rr_dt),
      ni: item.nm_id,
      sa: item.sa_name,
      bc: item.brand_name,
      sj: item.subject_name,
      sz: item.ts_name,
      dl: item.delivery_amount || 0,
      rt: item.return_amount || 0,
      dr: item.delivery_rub || 0,
    }
  }

  /**
   * Преобразует запись API в запись для таблицы штрафов
   */
  private mapToPenalty(item: WBReportRow): IPenalty {
    return {
      pk: this.generatePK(item),
      dt: this.formatDate(item.rr_dt),
      ni: item.nm_id,
      sa: item.sa_name,
      bc: item.brand_name,
      sj: item.subject_name,
      sz: item.ts_name,
      bt: item.bonus_type_name || '',
      pn: item.penalty || 0,
    }
  }

  /**
   * Преобразует запись API в запись для таблицы удержаний
   */
  private mapToDeduction(item: WBReportRow): IDeduction {
    return {
      pk: this.generatePK(item),
      dt: this.formatDate(item.rr_dt),
      ni: item.nm_id,
      sa: item.sa_name,
      bc: item.brand_name,
      sj: item.subject_name,
      sz: item.ts_name,
      bt: item.bonus_type_name || '',
      dd: item.deduction || 0,
    }
  }

  /**
   * Распределяет данные по таблицам с группировкой и сохраняет в БД
   * Группирует записи по PK (nm_id + rr_dt + ts_name) и суммирует числовые поля
   */
  private async distributeAndSave(items: WBReportRow[]): Promise<void> {
    // Map для группировки записей по PK
    const salesMap = new Map<string, ISale>()
    const returnsMap = new Map<string, IReturn>()
    const logisticsMap = new Map<string, ILogistics>()
    const penaltiesMap = new Map<string, IPenalty>()
    const deductionsMap = new Map<string, IDeduction>()

    // Распределяем и группируем данные
    for (const item of items) {
      const operName = item.supplier_oper_name

      switch (operName) {
        case 'Продажа': {
          const sale = this.mapToSale(item)
          const existing = salesMap.get(sale.pk)
          if (existing) {
            // Суммируем числовые поля
            existing.qt = (existing.qt || 0) + (sale.qt || 0)
            existing.pv = (existing.pv || 0) + (sale.pv || 0)
            existing.pa = (existing.pa || 0) + (sale.pa || 0)
            existing.pz = (existing.pz || 0) + (sale.pz || 0)
          } else {
            salesMap.set(sale.pk, sale)
          }
          break
        }

        case 'Возврат': {
          const ret = this.mapToReturn(item)
          const existing = returnsMap.get(ret.pk)
          if (existing) {
            // Суммируем числовые поля
            existing.qt = (existing.qt || 0) + (ret.qt || 0)
            existing.pv = (existing.pv || 0) + (ret.pv || 0)
            existing.pa = (existing.pa || 0) + (ret.pa || 0)
            existing.pz = (existing.pz || 0) + (ret.pz || 0)
          } else {
            returnsMap.set(ret.pk, ret)
          }
          break
        }

        case 'Логистика': {
          const log = this.mapToLogistics(item)
          const existing = logisticsMap.get(log.pk)
          if (existing) {
            // Суммируем числовые поля
            existing.dl = (existing.dl || 0) + (log.dl || 0)
            existing.rt = (existing.rt || 0) + (log.rt || 0)
            existing.dr = (existing.dr || 0) + (log.dr || 0)
          } else {
            logisticsMap.set(log.pk, log)
          }
          break
        }

        case 'Штраф': {
          const penalty = this.mapToPenalty(item)
          const existing = penaltiesMap.get(penalty.pk)
          if (existing) {
            // Суммируем числовые поля
            existing.pn = (existing.pn || 0) + (penalty.pn || 0)
          } else {
            penaltiesMap.set(penalty.pk, penalty)
          }
          break
        }

        case 'Удержание': {
          const deduction = this.mapToDeduction(item)
          const existing = deductionsMap.get(deduction.pk)
          if (existing) {
            // Суммируем числовые поля
            existing.dd = (existing.dd || 0) + (deduction.dd || 0)
          } else {
            deductionsMap.set(deduction.pk, deduction)
          }
          break
        }

        default:
          // Пропускаем неизвестные типы операций без логирования
          break
      }
    }

    // Преобразуем Map в массивы для сохранения
    const sales = Array.from(salesMap.values())
    const returns = Array.from(returnsMap.values())
    const logistics = Array.from(logisticsMap.values())
    const penalties = Array.from(penaltiesMap.values())
    const deductions = Array.from(deductionsMap.values())

    // Сохраняем все данные в БД атомарно
    // bulkPut автоматически заменяет записи с существующими PK (overwrite)
    await Promise.all([
      sales.length > 0 ? db.sales.bulkPut(sales) : Promise.resolve(),
      returns.length > 0 ? db.returns.bulkPut(returns) : Promise.resolve(),
      logistics.length > 0 ? db.logistics.bulkPut(logistics) : Promise.resolve(),
      penalties.length > 0 ? db.penalties.bulkPut(penalties) : Promise.resolve(),
      deductions.length > 0 ? db.deductions.bulkPut(deductions) : Promise.resolve(),
    ])
  }

  /**
   * Загружает полный отчет с пагинацией и сохраняет данные в БД
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @param period Период: 'daily' или 'weekly'
   * @returns Общее количество загруженных записей
   */
  async fetchFullReport(
    dateFrom: string,
    dateTo: string,
    period: 'daily' | 'weekly' = 'weekly'
  ): Promise<number> {
    // Форматируем даты в RFC3339 с часовым поясом Москва (UTC+3)
    const dateFromFormatted = `${dateFrom}T00:00:00+03:00`
    const dateToFormatted = `${dateTo}T23:59:59+03:00`

    let currentRrdId: number | undefined = undefined
    let hasMore = true
    let totalLoaded = 0

    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      while (hasMore) {
        try {
          const data: WBReportRow[] = await this.apiClient.fetchReportPage(
            dateFromFormatted,
            dateToFormatted,
            period,
            currentRrdId
          )

          // Пустой массив означает конец данных (204 статус)
          if (data.length === 0) {
            hasMore = false
            break
          }

          // Распределяем и сохраняем данные сразу после получения страницы
          await this.distributeAndSave(data)

          totalLoaded += data.length
          this.loadedCount.value = totalLoaded

          // Определяем следующий rrdid из последней записи
          const lastRecord = data[data.length - 1]
          if (lastRecord?.rrd_id !== undefined && lastRecord.rrd_id !== null) {
            const nextRrdId = lastRecord.rrd_id

            // Проверка на бесконечный цикл
            if (currentRrdId !== undefined && nextRrdId <= currentRrdId) {
              hasMore = false
              break
            }

            currentRrdId = nextRrdId
          } else {
            // Если нет rrd_id, прекращаем пагинацию
            hasMore = false
            break
          }

          // Задержка перед следующим запросом (лимит API: 1 запрос/минуту)
          if (hasMore) {
            await this.waitForRateLimit()
          }
        } catch (error: any) {
          // Если ошибка 429, ждем и повторяем запрос
          if (error?.status === 429 || error?.response?.status === 429) {
            await this.waitForRateLimit()
            continue // Повторяем тот же запрос
          }

          // Для других ошибок пробрасываем исключение
          throw error
        }
      }

      this.isFetching.value = false
      return totalLoaded
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке отчета'
      throw error
    }
  }

  /**
   * Задержка для соблюдения лимита API
   */
  private async waitForRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.API_RATE_LIMIT_MS))
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
