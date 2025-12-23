import { db } from '../db/database'
import type { Sale } from '@core/domain/entities/Sale'
import type { ISaleRepository } from '@core/domain/repositories/IWBRepository'

export class SaleRepository implements ISaleRepository {
  async getAll(): Promise<Sale[]> {
    return await db.legacySales.toArray()
  }

  async getById(id: number): Promise<Sale | undefined> {
    return await db.legacySales.get(id)
  }

  async create(sale: Sale): Promise<number> {
    return await db.legacySales.add(sale)
  }

  async createMany(sales: Sale[]): Promise<number> {
    return await db.legacySales.bulkAdd(sales)
  }

  async update(sale: Sale): Promise<void> {
    if (sale.id) {
      await db.legacySales.update(sale.id, sale)
    }
  }

  async delete(id: number): Promise<void> {
    await db.legacySales.delete(id)
  }

  async clear(): Promise<void> {
    await db.legacySales.clear()
  }

  async getByDateRange(from: string, to: string): Promise<Sale[]> {
    return await db.legacySales
      .where('date')
      .between(from, to, true, true)
      .toArray()
  }
}
