import type { LoadedPeriodRepository } from './LoadedPeriodRepository'
import type { ILoadedPeriod } from '../../types/db'
import { db } from '../../db/db'

/**
 * Реализация LoadedPeriodRepository на основе Dexie (IndexedDB)
 * Использует таблицу loaded_periods с двухбуквенными индексами
 * Метод add выполняет upsert: обновляет существующую запись или создает новую
 */
export class DbLoadedPeriodRepository implements LoadedPeriodRepository {
  async add(period: Omit<ILoadedPeriod, 'id'>): Promise<number> {
    const sameDatasetPeriods = await db.loaded_periods
      .where('ds')
      .equals(period.ds)
      .and(p => p.pt === period.pt)
      .toArray()

    const overlaps: ILoadedPeriod[] = []
    let mergedFrom = period.fr
    let mergedTo = period.to

    for (const existing of sameDatasetPeriods) {
      if (this.isOverlappingOrAdjacent(existing, period)) {
        overlaps.push(existing)
        if (existing.fr < mergedFrom) mergedFrom = existing.fr
        if (existing.to > mergedTo) mergedTo = existing.to
      }
    }

    if (overlaps.length > 0) {
      const idsToDelete = overlaps
        .map(p => p.id)
        .filter((id): id is number => typeof id === 'number')
      if (idsToDelete.length > 0) {
        await db.loaded_periods.bulkDelete(idsToDelete)
      }
    }

    const record: ILoadedPeriod = {
      ...period,
      fr: mergedFrom,
      to: mergedTo,
    }

    return await db.loaded_periods.put(record)
  }
  
  async isLoaded(dataset: string, from: string, to: string): Promise<boolean> {
    // Используем составной индекс [ds+fr] для быстрого поиска
    const found = await db.loaded_periods
      .where('[ds+fr]')
      .equals([dataset, from])
      .and(record => record.to === to)
      .first()
    
    return found !== undefined
  }
  
  async getByDataset(dataset: string): Promise<ILoadedPeriod[]> {
    return await db.loaded_periods
      .where('ds')
      .equals(dataset)
      .toArray()
  }
  
  async getByDateRange(dataset: string, from: string, to: string): Promise<ILoadedPeriod[]> {
    // Получаем все периоды для датасета, которые пересекаются с указанным диапазоном
    // Период пересекается, если:
    // - его начало <= to И его конец >= from
    return await db.loaded_periods
      .where('ds')
      .equals(dataset)
      .filter(period => {
        return period.fr <= to && period.to >= from
      })
      .toArray()
  }
  
  async remove(id: number): Promise<void> {
    await db.loaded_periods.delete(id)
  }
  
  async removeByDataset(dataset: string): Promise<void> {
    await db.loaded_periods
      .where('ds')
      .equals(dataset)
      .delete()
  }

  private isOverlappingOrAdjacent(a: Pick<ILoadedPeriod, 'fr' | 'to'>, b: Pick<ILoadedPeriod, 'fr' | 'to'>): boolean {
    return this.toMillis(a.fr) <= this.addDaysMillis(b.to, 1) &&
           this.toMillis(b.fr) <= this.addDaysMillis(a.to, 1)
  }

  private toMillis(isoDate: string): number {
    return new Date(isoDate).getTime()
  }

  private addDaysMillis(isoDate: string, days: number): number {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + days)
    return d.getTime()
  }
}
