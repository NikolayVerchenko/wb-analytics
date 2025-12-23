import { BaseSyncService } from './BaseSyncService'
import { SaleRepository } from '../repositories/SaleRepository'
import type { Sale } from '@core/domain/entities/Sale'
import type { SyncOptions } from './BaseSyncService'
import type { WBApiClient } from '../api/wbApiClient'

export class SaleSyncService extends BaseSyncService<Sale> {
  private repository: SaleRepository

  constructor(apiClient: WBApiClient, repository: SaleRepository) {
    super(apiClient)
    this.repository = repository
  }

  async fetchFromApi(options: SyncOptions): Promise<Sale[]> {
    return await this.apiClient.getSales(options.dateFrom, options.dateTo)
  }

  async saveToDatabase(sales: Sale[]): Promise<void> {
    if (sales.length === 0) return
    
    await this.repository.createMany(sales)
  }

  async clearDatabase(): Promise<void> {
    await this.repository.clear()
  }
}
