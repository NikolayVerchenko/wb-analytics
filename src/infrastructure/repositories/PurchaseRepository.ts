import type { IPurchaseRepository } from '../../core/domain/purchases/IPurchaseRepository'
import type { IPurchase } from '../../types/db'
import type { WbDatabase } from '../../db/db'

/**
 * Реализация репозитория закупок через Dexie
 */
export class PurchaseRepository implements IPurchaseRepository {
  constructor(private db: WbDatabase) {}

  async getAll(): Promise<IPurchase[]> {
    return this.db.purchases.orderBy('date').reverse().toArray()
  }

  async getById(id: number): Promise<IPurchase | undefined> {
    return this.db.purchases.get(id)
  }

  async save(purchase: IPurchase): Promise<number> {
    try {
      // Ensure the object is plain to avoid DataCloneError with Vue's reactive objects
      const plainPurchase = JSON.parse(JSON.stringify(purchase))
      
      if (plainPurchase.id) {
        await this.db.purchases.put(plainPurchase)
        return plainPurchase.id
      } else {
        return await this.db.purchases.add(plainPurchase)
      }
    } catch (error) {
      console.error('[PurchaseRepository] Error saving purchase:', error)
      throw error
    }
  }

  async delete(id: number): Promise<void> {
    await this.db.purchases.delete(id)
  }

  async findByDateRange(dateFrom: string, dateTo: string): Promise<IPurchase[]> {
    return this.db.purchases
      .where('date')
      .between(dateFrom, dateTo, true, true)
      .toArray()
  }
}
