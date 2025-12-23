import { BaseSyncService } from './BaseSyncService'
import { ExpenseRepository } from '../repositories/ExpenseRepository'
import type { Expense } from '@core/domain/entities/Expense'
import type { SyncOptions } from './BaseSyncService'
import type { WBApiClient } from '../api/wbApiClient'

export class ExpenseSyncService extends BaseSyncService<Expense> {
  private repository: ExpenseRepository

  constructor(apiClient: WBApiClient, repository: ExpenseRepository) {
    super(apiClient)
    this.repository = repository
  }

  async fetchFromApi(options: SyncOptions): Promise<Expense[]> {
    return await this.apiClient.getExpenses(options.dateFrom, options.dateTo)
  }

  async saveToDatabase(expenses: Expense[]): Promise<void> {
    if (expenses.length === 0) return
    
    await this.repository.createMany(expenses)
  }

  async clearDatabase(): Promise<void> {
    await this.repository.clear()
  }
}
