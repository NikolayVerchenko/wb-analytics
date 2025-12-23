import { db } from '../db/database'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'
import type { AggregatedReturn } from '@infrastructure/aggregators/DataAggregator'

export class ReportReturnRepository {
  /**
   * Создает составной ключ для поиска дубликатов
   */
  private createCompositeKey(returnItem: ReportReturn | AggregatedReturn): string {
    const date = returnItem.rr_dt.split('T')[0] // Извлекаем только дату
    return `${date}|${returnItem.nm_id}|${returnItem.ts_name}`
  }

  async getAll(): Promise<ReportReturn[]> {
    return await db.returns.toArray()
  }

  async getById(id: number): Promise<ReportReturn | undefined> {
    return await db.returns.get(id)
  }

  async create(returnItem: ReportReturn | AggregatedReturn): Promise<number> {
    return await db.returns.add(returnItem as ReportReturn)
  }

  async createMany(returns: (ReportReturn | AggregatedReturn)[]): Promise<number> {
    // Для агрегированных данных проверяем существующие записи по составному ключу
    // и обновляем их или добавляем новые
    const toUpdate: ReportReturn[] = []
    const toAdd: ReportReturn[] = []

    // Группируем по дате для оптимизации запросов
    const returnsByDate = new Map<string, (ReportReturn | AggregatedReturn)[]>()
    for (const returnItem of returns) {
      const date = returnItem.rr_dt.split('T')[0]
      if (!returnsByDate.has(date)) {
        returnsByDate.set(date, [])
      }
      returnsByDate.get(date)!.push(returnItem)
    }

    // Обрабатываем каждую дату отдельно
    for (const [date, dateReturns] of returnsByDate) {
      // Получаем все существующие записи за эту дату один раз
      // Учитываем только записи с тем же is_final флагом
      const allRecords = await db.returns.where('rr_dt').equals(date).toArray()
      const isFinalFlag = dateReturns[0]?.is_final ?? false
      const existingRecords = allRecords.filter(r => (r.is_final ?? false) === isFinalFlag)
      const existingMap = new Map<string, ReportReturn>()
      
      // Создаем Map для быстрого поиска по составному ключу
      for (const record of existingRecords) {
        const key = `${record.nm_id}|${record.ts_name}`
        existingMap.set(key, record)
      }

      for (const returnItem of dateReturns) {
        const key = `${returnItem.nm_id}|${returnItem.ts_name}`
        const existing = existingMap.get(key)

        if (existing) {
          // Обновляем существующую запись, суммируя числовые поля
          const updated: ReportReturn = {
            ...existing,
            quantity: (existing.quantity || 0) + (returnItem.quantity || 0),
            retail_price: (existing.retail_price || 0) + (returnItem.retail_price || 0),
            retail_amount: (existing.retail_amount || 0) + (returnItem.retail_amount || 0),
            delivery_amount: (existing.delivery_amount || 0) + (returnItem.delivery_amount || 0),
            return_amount: (existing.return_amount || 0) + (returnItem.return_amount || 0),
            delivery_rub: (existing.delivery_rub || 0) + (returnItem.delivery_rub || 0),
            ppvz_for_pay: (existing.ppvz_for_pay || 0) + (returnItem.ppvz_for_pay || 0),
            penalty: (existing.penalty || 0) + (returnItem.penalty || 0),
            additional_payment: (existing.additional_payment || 0) + (returnItem.additional_payment || 0),
          }
          toUpdate.push(updated)
        } else {
          // Новая запись
          toAdd.push(returnItem as ReportReturn)
        }
      }
    }

    // Обновляем существующие записи
    if (toUpdate.length > 0) {
      await db.returns.bulkPut(toUpdate)
    }

    // Добавляем новые записи
    if (toAdd.length > 0) {
      await db.returns.bulkAdd(toAdd)
    }

    return toUpdate.length + toAdd.length
  }

  async clear(): Promise<void> {
    await db.returns.clear()
  }

  async getByDateRange(from: string, to: string): Promise<ReportReturn[]> {
    return await db.returns
      .where('rr_dt')
      .between(from, to, true, true)
      .toArray()
  }
}
