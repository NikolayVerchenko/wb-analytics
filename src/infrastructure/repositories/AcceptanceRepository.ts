import { db } from '../db/database'
import type { Acceptance } from '@core/domain/entities/Acceptance'
import type { IAcceptanceRepository } from '@core/domain/repositories/IWBRepository'

export class AcceptanceRepository implements IAcceptanceRepository {
  async getAll(): Promise<Acceptance[]> {
    return await db.acceptance.toArray()
  }

  async getById(id: number): Promise<Acceptance | undefined> {
    return await db.acceptance.get(id)
  }

  async create(acceptance: Acceptance): Promise<number> {
    return await db.acceptance.add(acceptance)
  }

  async createMany(acceptances: Acceptance[]): Promise<number> {
    return await db.acceptance.bulkAdd(acceptances)
  }

  async update(acceptance: Acceptance): Promise<void> {
    if (acceptance.id) {
      await db.acceptance.update(acceptance.id, acceptance)
    }
  }

  async delete(id: number): Promise<void> {
    await db.acceptance.delete(id)
  }

  async clear(): Promise<void> {
    await db.acceptance.clear()
  }

  async getByDateRange(from: string, to: string): Promise<Acceptance[]> {
    return await db.acceptance
      .where('date')
      .between(from, to, true, true)
      .toArray()
  }
}
