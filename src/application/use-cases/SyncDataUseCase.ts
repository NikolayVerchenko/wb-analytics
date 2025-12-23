import type { OrderSyncService } from '@infrastructure/services/OrderSyncService'
import type { ExpenseSyncService } from '@infrastructure/services/ExpenseSyncService'
import type { SyncOptions } from '@infrastructure/services/BaseSyncService'

export interface SyncDataUseCaseOptions extends SyncOptions {
  syncOrders?: boolean
  syncExpenses?: boolean
  clearBeforeSync?: boolean
}

export class SyncDataUseCase {
  constructor(
    private orderSyncService: OrderSyncService,
    private expenseSyncService: ExpenseSyncService
  ) {}

  async execute(options: SyncDataUseCaseOptions): Promise<void> {
    const { syncOrders = true, syncExpenses = true, clearBeforeSync = false } = options

    const syncOptions: SyncOptions = {
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      onProgress: options.onProgress,
    }

    const promises: Promise<void>[] = []

    if (syncOrders) {
      if (clearBeforeSync) {
        await this.orderSyncService.clearDatabase()
      }
      promises.push(this.orderSyncService.sync(syncOptions))
    }

    if (syncExpenses) {
      if (clearBeforeSync) {
        await this.expenseSyncService.clearDatabase()
      }
      promises.push(this.expenseSyncService.sync(syncOptions))
    }

    await Promise.all(promises)
  }
}
