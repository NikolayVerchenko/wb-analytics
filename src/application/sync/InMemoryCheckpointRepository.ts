import type { CheckpointRepository } from './CheckpointRepository'
import type { Checkpoint } from './types'

export class InMemoryCheckpointRepository implements CheckpointRepository {
  private store = new Map<string, Checkpoint>()

  async get(key: string): Promise<Checkpoint | null> {
    return this.store.get(key) ?? null
  }

  async upsert(checkpoint: Checkpoint): Promise<void> {
    this.store.set(checkpoint.dataset, checkpoint)
  }
}
