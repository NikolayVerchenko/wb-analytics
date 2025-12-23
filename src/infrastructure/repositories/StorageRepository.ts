import { db } from '../db/database'
import type { Storage } from '@core/domain/entities/Storage'
import type { IStorageRepository } from '@core/domain/repositories/IWBRepository'

export class StorageRepository implements IStorageRepository {
  async getAll(): Promise<Storage[]> {
    return await db.storage.toArray()
  }

  async getById(id: number): Promise<Storage | undefined> {
    return await db.storage.get(id)
  }

  async create(storage: Storage): Promise<number> {
    return await db.storage.add(storage)
  }

  async createMany(storages: Storage[]): Promise<number> {
    return await db.storage.bulkAdd(storages)
  }

  async update(storage: Storage): Promise<void> {
    if (storage.id) {
      await db.storage.update(storage.id, storage)
    }
  }

  async delete(id: number): Promise<void> {
    await db.storage.delete(id)
  }

  async clear(): Promise<void> {
    await db.storage.clear()
  }
}
