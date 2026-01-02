import { BaseSyncService } from './BaseSyncService'
import { ExpenseRepository } from '../repositories/ExpenseRepository'
import type { Expense } from '@core/domain/entities/Expense'
import type { SyncOptions } from './BaseSyncService'
import type { WBApiClient } from '../api/wbApiClient'
import type { AdMappingService } from '@application/services/AdMappingService'

export class ExpenseSyncService extends BaseSyncService<Expense> {
  private repository: ExpenseRepository
  private adMappingService?: AdMappingService

  constructor(apiClient: WBApiClient, repository: ExpenseRepository, adMappingService?: AdMappingService) {
    super(apiClient)
    this.repository = repository
    this.adMappingService = adMappingService
  }

  async fetchFromApi(options: SyncOptions): Promise<Expense[]> {
    return await this.apiClient.getExpenses(options.dateFrom, options.dateTo)
  }

  async saveToDatabase(expenses: Expense[]): Promise<void> {
    if (expenses.length === 0) return
    
    await this.repository.createMany(expenses)
    
    // После сохранения затрат обрабатываем маппинги рекламных кампаний
    if (this.adMappingService) {
      try {
        await this.adMappingService.processExpenses(expenses)
      } catch (error) {
        console.error('Ошибка при обработке маппингов рекламных кампаний:', error)
        // Не прерываем синхронизацию при ошибке маппинга
      }
    }
  }

  async clearDatabase(): Promise<void> {
    await this.repository.clear()
  }
}
