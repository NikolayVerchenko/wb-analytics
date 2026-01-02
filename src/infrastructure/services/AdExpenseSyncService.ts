import { BaseSyncService } from './BaseSyncService'
import { AdExpenseRepository } from '../repositories/AdExpenseRepository'
import type { AdExpense } from '@core/domain/entities/AdExpense'
import type { SyncOptions } from './BaseSyncService'
import type { WBApiClient } from '../api/wbApiClient'
import type { LoggerService } from '@application/services/LoggerService'
import type { SyncRegistryRepository } from '../repositories/SyncRegistryRepository'
import type { AdMappingService } from '@application/services/AdMappingService'

/**
 * Сервис синхронизации рекламных расходов
 * Реализует плоское сохранение в таблицу ad_expenses
 * Ключ уникальности: ${nmId}_${updTime}_${advertId}
 */
export class AdExpenseSyncService extends BaseSyncService<AdExpense> {
  private repository: AdExpenseRepository
  private logger?: LoggerService
  private syncRegistry?: SyncRegistryRepository
  private adMappingService?: AdMappingService

  constructor(
    apiClient: WBApiClient,
    repository: AdExpenseRepository,
    logger?: LoggerService,
    syncRegistry?: SyncRegistryRepository,
    adMappingService?: AdMappingService
  ) {
    super(apiClient)
    this.repository = repository
    this.logger = logger
    this.syncRegistry = syncRegistry
    this.adMappingService = adMappingService
  }

  async fetchFromApi(options: SyncOptions): Promise<AdExpense[]> {
    const { dateFrom, dateTo } = options
    
    console.log('🔍 [AdExpenseSync] fetchFromApi вызван с опциями:', { dateFrom, dateTo })
    
    if (!dateTo) {
      console.error('❌ [AdExpenseSync] dateTo отсутствует!')
      throw new Error('dateTo is required for AdExpenseSyncService')
    }

    this.logger?.add('info', `Загрузка рекламных расходов за период: ${dateFrom} - ${dateTo}`)
    console.log(`📊 [AdExpenseSync] Загрузка рекламных расходов за период: ${dateFrom} - ${dateTo}`)

    // 1. Получаем историю затрат из /adv/v1/upd
    const history = await this.apiClient.getAdvertsHistory(dateFrom, dateTo)
    
    if (history.length === 0) {
      this.logger?.add('info', 'Нет данных рекламных затрат для синхронизации')
      return []
    }

    this.logger?.add('info', `Получено ${history.length} записей истории рекламных затрат`)

    // 2. Группируем по advertId для оптимизации запросов к API
    const expensesByAdvertId = new Map<number, Array<{ date: string; sum: number; updTime?: number }>>()
    history.forEach(item => {
      if (!expensesByAdvertId.has(item.advertId)) {
        expensesByAdvertId.set(item.advertId, [])
      }
      expensesByAdvertId.get(item.advertId)!.push({
        date: item.date,
        sum: item.sum,
        updTime: item.updTime || Date.now(),
      })
    })

    // 3. Автоматически вызываем API для получения nm_id при обнаружении новых advertId
    // Используем AdMappingService для обновления маппингов (если доступен)
    const advertIds = Array.from(expensesByAdvertId.keys())
    
    // Если AdMappingService доступен, обновляем маппинги для новых advertId
    if (this.adMappingService && advertIds.length > 0) {
      try {
        // Создаем временные Expense объекты для обработки маппингов
        const tempExpenses = advertIds.map(advertId => ({
          date: dateFrom,
          type: 'advert',
          sum: 0,
          name: `Кампания ${advertId}`,
          advertId,
        })) as any[]
        
        await this.adMappingService.processExpenses(tempExpenses)
        this.logger?.add('info', `Обновлены маппинги для ${advertIds.length} рекламных кампаний`)
      } catch (error) {
        this.logger?.add('warn', `Ошибка при обновлении маппингов: ${error instanceof Error ? error.message : String(error)}`)
        // Продолжаем синхронизацию даже при ошибке маппингов
      }
    }
    
    // 4. Для каждого уникального advertId запрашиваем информацию о кампании через /api/advert/v2/adverts
    const advertsDetails = await this.apiClient.getAdvertsDetails(advertIds)
    this.logger?.add('info', `Получено ${advertsDetails.length} деталей рекламных кампаний`)

    // 5. Создаем маппинг advertId -> nmIds и campName
    const advertInfoMap = new Map<number, { nmIds: number[]; campName?: string }>()
    advertsDetails.forEach(advert => {
      if (advert.nms && advert.nms.length > 0) {
        advertInfoMap.set(advert.advertId, {
          nmIds: advert.nms,
          campName: advert.name,
        })
      }
    })

    // 6. Распределяем затраты и формируем записи для сохранения
    const expensesToSave: AdExpense[] = []

    expensesByAdvertId.forEach((expenses, advertId) => {
      const advertInfo = advertInfoMap.get(advertId)
      
      if (!advertInfo || !advertInfo.nmIds || advertInfo.nmIds.length === 0) {
        this.logger?.add('warn', `Не найдены артикулы для кампании ${advertId}, пропускаем`)
        return
      }

      const { nmIds, campName } = advertInfo

      // Для каждой даты распределяем сумму по артикулам (равномерно)
      expenses.forEach(expense => {
        const updTime = expense.updTime || Date.now()
        const sumPerProduct = expense.sum / nmIds.length

        nmIds.forEach(nmId => {
          // Ключ уникальности: ${nmId}_${updTime}_${advertId}
          const uniqueKey = `${nmId}_${updTime}_${advertId}`

          expensesToSave.push({
            uniqueKey,
            nmId,
            date: expense.date,
            sum: parseFloat(sumPerProduct.toFixed(2)), // Округляем до 2 знаков
            advertId,
            campName,
            updTime,
          })
        })
      })
    })

    this.logger?.add('info', `Подготовлено ${expensesToSave.length} записей рекламных расходов для сохранения`)
    return expensesToSave
  }

  async saveToDatabase(expenses: AdExpense[]): Promise<void> {
    console.log(`💾 [AdExpenseSync] saveToDatabase вызван с ${expenses.length} записями`)
    
    if (expenses.length === 0) {
      console.log('⚠️ [AdExpenseSync] Нет данных для сохранения')
      return
    }
    
    // Определяем период данных для удаления старых записей
    const dates = expenses.map(e => e.date).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]
    
    console.log(`🗑️ [AdExpenseSync] Удаление старых данных за период: ${minDate} - ${maxDate}`)
    // Удаляем старые данные за период (для актуализации возможных изменений)
    await this.repository.deleteByDateRange(minDate, maxDate)
    this.logger?.add('info', `Удалены старые данные рекламных расходов за период: ${minDate} - ${maxDate}`)
    
    console.log(`💾 [AdExpenseSync] Сохранение ${expenses.length} записей...`)
    // Используем createMany, который автоматически обрабатывает уникальность через uniqueKey
    // bulkPut уже используется внутри createMany для обновления существующих записей
    const savedCount = await this.repository.createMany(expenses)
    this.logger?.add('info', `Сохранено ${savedCount} записей рекламных расходов (используется bulkPut для обновления)`)
    console.log(`✅ [AdExpenseSync] Сохранено ${savedCount} записей рекламных расходов`)
  }

  async clearDatabase(): Promise<void> {
    await this.repository.clear()
  }
}

