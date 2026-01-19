import type { CheckpointRepository } from './CheckpointRepository'
import type { Checkpoint } from './types'
import { db } from '../../db/db'

/**
 * Реализация CheckpointRepository на основе Dexie (IndexedDB)
 * Хранит чекпоинты в таблице settings с ключом `sync_checkpoint_${key}`
 */
export class DbCheckpointRepository implements CheckpointRepository {
  private readonly KEY_PREFIX = 'sync_checkpoint_'

  private getKey(key: string): string {
    return `${this.KEY_PREFIX}${key}`
  }

  async get(key: string): Promise<Checkpoint | null> {
    const storageKey = this.getKey(key)
    const record = await db.settings.get(storageKey)
    
    if (!record) {
      return null
    }

    try {
      return JSON.parse(record.value) as Checkpoint
    } catch (error) {
      console.error(`[DbCheckpointRepository] Ошибка парсинга checkpoint для ${key}:`, error)
      return null
    }
  }

  async upsert(checkpoint: Checkpoint): Promise<void> {
    const key = this.getKey(checkpoint.dataset)
    const value = JSON.stringify(checkpoint)
    
    await db.settings.put({
      key,
      value,
    })
  }
}
