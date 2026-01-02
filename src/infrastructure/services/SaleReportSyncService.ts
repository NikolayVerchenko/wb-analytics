import type { WBApiClient } from '../api/wbApiClient'
import { BaseSyncService } from './BaseSyncService'
import type { ISale } from '@core/domain/entities/SaleCompact'
import { ReportTransformService } from './ReportTransformService'
import { SaleRepository } from '../repositories/SaleRepository'
import type { SyncOptions } from './BaseSyncService'
import type { LoggerService } from '@application/services/LoggerService'
import { db } from '../db/database'

/**
 * Сервис синхронизации отчетов о реализации (v5)
 * Использует компактный формат ISale с короткими ключами
 */
export class SaleReportSyncService extends BaseSyncService<ISale> {
  private transformService: ReportTransformService
  private saleRepository: SaleRepository
  private logger: LoggerService

  constructor(apiClient: WBApiClient, logger: LoggerService) {
    super(apiClient)
    this.transformService = new ReportTransformService()
    this.saleRepository = new SaleRepository()
    this.logger = logger
  }

  /**
   * Загружает данные из API с рекурсивной пагинацией
   */
  async fetchFromApi(options: SyncOptions): Promise<ISale[]> {
    this.logger.add('info', `[SaleReportSyncService] Начало загрузки отчетов: ${options.dateFrom} - ${options.dateTo || 'текущая дата'}`)
    
    const dateTo = options.dateTo || this.formatDate(new Date())
    
    // Загружаем данные с пагинацией
    const rawData = await this.apiClient.fetchReportDetail(options.dateFrom, dateTo, 0)
    
    this.logger.add('info', `[SaleReportSyncService] Загружено ${rawData.length} сырых записей из API`)
    
    // Трансформируем данные
    const transformed = this.transformService.transformReportRows(rawData)
    
    this.logger.add('info', `[SaleReportSyncService] Трансформировано ${transformed.length} записей (возвраты отфильтрованы)`)
    
    return transformed
  }

  /**
   * Сохраняет данные в базу через репозиторий
   */
  async saveToDatabase(items: ISale[]): Promise<void> {
    if (items.length === 0) {
      this.logger.add('info', `[SaleReportSyncService] Нет данных для сохранения`)
      return
    }

    this.logger.add('info', `[SaleReportSyncService] Сохранение ${items.length} записей в базу данных...`)
    
    const saved = await this.saleRepository.saveReportBatch(items)
    
    this.logger.add('info', `[SaleReportSyncService] Сохранено ${saved} записей`)
  }

  /**
   * Очищает базу данных (опционально, для полной синхронизации)
   */
  async clearDatabase(): Promise<void> {
    await this.saleRepository.clear()
    this.logger.add('info', `[SaleReportSyncService] База данных очищена`)
  }

  /**
   * Получает дату последнего загруженного отчета для инкрементальной синхронизации
   * @returns Дата последнего отчета в формате YYYY-MM-DD или null
   */
  async getLastReportDate(): Promise<string | null> {
    try {
      // Получаем последнюю запись по дате
      const lastSale = await db.sales
        .orderBy('dt')
        .reverse()
        .first()
      
      if (lastSale?.dt) {
        return lastSale.dt
      }
      
      return null
    } catch (error) {
      this.logger.add('error', `[SaleReportSyncService] Ошибка при получении последней даты: ${error}`)
      return null
    }
  }

  /**
   * Инкрементальная синхронизация: загружает данные с даты последнего отчета
   * @param dateTo Конечная дата (по умолчанию текущая)
   */
  async syncIncremental(dateTo?: string): Promise<void> {
    const lastDate = await this.getLastReportDate()
    
    if (lastDate) {
      // Вычисляем следующую дату после последней загруженной
      const nextDate = new Date(lastDate)
      nextDate.setDate(nextDate.getDate() + 1)
      const dateFrom = this.formatDate(nextDate)
      
      this.logger.add('info', `[SaleReportSyncService] Инкрементальная синхронизация с ${dateFrom}`)
      
      await this.sync({
        dateFrom,
        dateTo: dateTo || this.formatDate(new Date()),
      })
    } else {
      // Если нет последней даты, синхронизируем за последние 30 дней
      const dateToStr = dateTo || this.formatDate(new Date())
      const dateFrom = new Date(dateToStr)
      dateFrom.setDate(dateFrom.getDate() - 30)
      
      this.logger.add('info', `[SaleReportSyncService] Первая синхронизация за последние 30 дней`)
      
      await this.sync({
        dateFrom: this.formatDate(dateFrom),
        dateTo: dateToStr,
      })
    }
  }
}

