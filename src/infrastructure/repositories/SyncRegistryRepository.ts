import { db } from '../db/database'
import type { SyncRegistryEntry, SyncType, SyncStatus } from '@core/domain/entities/SyncRegistryEntry'

export class SyncRegistryRepository {
  /**
   * Получить запись по periodId и type
   */
  async getByPeriod(periodId: string, type: SyncType): Promise<SyncRegistryEntry | undefined> {
    // Используем составной индекс [periodId+type]
    return await db.syncRegistry
      .where('[periodId+type]')
      .equals([periodId, type])
      .first()
  }

  /**
   * Создать или обновить запись
   */
  async upsert(entry: SyncRegistryEntry): Promise<number> {
    const existing = await this.getByPeriod(entry.periodId, entry.type)
    
    if (existing) {
      const updated: SyncRegistryEntry = {
        ...existing,
        ...entry,
        updatedAt: Date.now(),
      }
      await db.syncRegistry.update(existing.id!, updated)
      return existing.id!
    } else {
      const newEntry: SyncRegistryEntry = {
        ...entry,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      return await db.syncRegistry.add(newEntry)
    }
  }

  /**
   * Получить все записи со статусом pending или waiting
   */
  async getPendingOrWaiting(): Promise<SyncRegistryEntry[]> {
    return await db.syncRegistry
      .where('status')
      .anyOf(['pending', 'waiting'])
      .toArray()
  }

  /**
   * Получить записи, которые готовы к повтору (nextRetryAt <= now)
   */
  async getReadyForRetry(now: number = Date.now()): Promise<SyncRegistryEntry[]> {
    const waiting = await db.syncRegistry
      .where('status')
      .equals('waiting')
      .toArray()
    
    return waiting.filter(entry => entry.nextRetryAt && entry.nextRetryAt <= now)
  }

  /**
   * Получить последнюю неделю, которая не является финальной
   */
  async getLastNonFinalWeek(): Promise<SyncRegistryEntry | undefined> {
    const weekly = await db.syncRegistry
      .where('type')
      .equals('weekly')
      .toArray()
    
    // Сортируем по periodId (формат YYYY-WNN) в обратном порядке
    const sorted = weekly
      .filter(entry => !entry.isFinal)
      .sort((a, b) => b.periodId.localeCompare(a.periodId))
    
    return sorted[0]
  }

  /**
   * Обновить статус записи
   */
  async updateStatus(
    periodId: string,
    type: SyncType,
    status: SyncStatus,
    nextRetryAt?: number,
    errorMessage?: string
  ): Promise<void> {
    const existing = await this.getByPeriod(periodId, type)
    if (!existing) {
      throw new Error(`SyncRegistryEntry not found: ${periodId} (${type})`)
    }

    const updated: SyncRegistryEntry = {
      ...existing,
      status,
      lastAttempt: Date.now(),
      nextRetryAt,
      errorMessage,
      updatedAt: Date.now(),
    }

    await db.syncRegistry.update(existing.id!, updated)
  }

  /**
   * Установить период как финальный
   */
  async setFinal(periodId: string, type: SyncType): Promise<void> {
    const existing = await this.getByPeriod(periodId, type)
    if (!existing) {
      throw new Error(`SyncRegistryEntry not found: ${periodId} (${type})`)
    }

    const updated: SyncRegistryEntry = {
      ...existing,
      isFinal: true,
      status: 'success',
      updatedAt: Date.now(),
    }

    await db.syncRegistry.update(existing.id!, updated)
  }

  /**
   * Удалить запись
   */
  async delete(periodId: string, type: SyncType): Promise<void> {
    const existing = await this.getByPeriod(periodId, type)
    if (existing?.id) {
      await db.syncRegistry.delete(existing.id)
    }
  }

  /**
   * Получить все записи
   */
  async getAll(): Promise<SyncRegistryEntry[]> {
    return await db.syncRegistry.toArray()
  }

  /**
   * Получить все записи со статусом, отличным от success
   * Используется для восстановления незавершенных задач
   */
  async getAllNonSuccess(): Promise<SyncRegistryEntry[]> {
    return await db.syncRegistry
      .where('status')
      .anyOf(['pending', 'waiting', 'failed'])
      .toArray()
  }
}
