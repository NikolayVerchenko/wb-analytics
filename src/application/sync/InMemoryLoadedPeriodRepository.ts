import type { LoadedPeriodRepository } from './LoadedPeriodRepository'
import type { ILoadedPeriod } from '../../types/db'

/**
 * In-memory реализация LoadedPeriodRepository для тестов
 */
export class InMemoryLoadedPeriodRepository implements LoadedPeriodRepository {
  private periods: Map<number, ILoadedPeriod> = new Map()
  private nextId = 1

  async add(period: Omit<ILoadedPeriod, 'id'>): Promise<number> {
    const id = this.nextId++
    this.periods.set(id, { ...period, id })
    return id
  }

  async isLoaded(dataset: string, from: string, to: string): Promise<boolean> {
    for (const period of this.periods.values()) {
      if (period.ds === dataset && period.fr === from && period.to === to) {
        return true
      }
    }
    return false
  }

  async getByDataset(dataset: string): Promise<ILoadedPeriod[]> {
    return Array.from(this.periods.values()).filter(p => p.ds === dataset)
  }

  async getByDateRange(dataset: string, from: string, to: string): Promise<ILoadedPeriod[]> {
    return Array.from(this.periods.values()).filter(
      p => p.ds === dataset && p.fr <= to && p.to >= from
    )
  }

  async remove(id: number): Promise<void> {
    this.periods.delete(id)
  }

  async removeByDataset(dataset: string): Promise<void> {
    for (const [id, period] of this.periods.entries()) {
      if (period.ds === dataset) {
        this.periods.delete(id)
      }
    }
  }
}
