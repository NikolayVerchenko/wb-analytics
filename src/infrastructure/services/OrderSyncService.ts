import { BaseSyncService } from './BaseSyncService'
import { OrderRepository } from '../repositories/OrderRepository'
import type { Order } from '@core/domain/entities/Order'
import type { SyncOptions } from './BaseSyncService'
import type { WBApiClient } from '../api/wbApiClient'

export class OrderSyncService extends BaseSyncService<Order> {
  private repository: OrderRepository

  constructor(apiClient: WBApiClient, repository: OrderRepository) {
    super(apiClient)
    this.repository = repository
  }

  async fetchFromApi(options: SyncOptions): Promise<Order[]> {
    return await this.apiClient.getOrders(options.dateFrom, options.dateTo)
  }

  async saveToDatabase(orders: Order[]): Promise<void> {
    if (orders.length === 0) return
    
    // Используем bulkAdd для эффективной вставки
    await this.repository.createMany(orders)
  }

  async clearDatabase(): Promise<void> {
    await this.repository.clear()
  }
}
