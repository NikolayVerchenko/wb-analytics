import { db } from '../db/database'
import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { AggregatedSale } from '@infrastructure/aggregators/DataAggregator'

export class ReportSaleRepository {
  async getAll(): Promise<ReportSale[]> {
    return await db.sales.toArray()
  }

  async getById(id: number): Promise<ReportSale | undefined> {
    return await db.sales.get(id)
  }

  async create(sale: ReportSale | AggregatedSale): Promise<number> {
    return await db.sales.add(sale as ReportSale)
  }

  async createMany(sales: (ReportSale | AggregatedSale)[]): Promise<number> {
    // Для агрегированных данных проверяем существующие записи по составному ключу
    // и обновляем их или добавляем новые
    const toUpdate: ReportSale[] = []
    const toAdd: ReportSale[] = []

    // Группируем по дате для оптимизации запросов
    const salesByDate = new Map<string, (ReportSale | AggregatedSale)[]>()
    for (const sale of sales) {
      const date = sale.rr_dt.split('T')[0]
      if (!salesByDate.has(date)) {
        salesByDate.set(date, [])
      }
      salesByDate.get(date)!.push(sale)
    }

    // Подсчитываем общее количество quantity для логирования
    const totalQuantity = sales.reduce((sum, s) => sum + (s.quantity || 0), 0)
    console.log(`[ReportSaleRepository] Сохранение ${sales.length} записей продаж, общее quantity=${totalQuantity}`)

    // Обрабатываем каждую дату отдельно
    for (const [date, dateSales] of salesByDate) {
      // Получаем все существующие записи за эту дату один раз
      // Учитываем только записи с тем же is_final флагом
      const allRecords = await db.sales.where('rr_dt').equals(date).toArray()
      const isFinalFlag = dateSales[0]?.is_final ?? false
      const existingRecords = allRecords.filter(r => (r.is_final ?? false) === isFinalFlag)
      const existingMap = new Map<string, ReportSale>()
      
      // Создаем Map для быстрого поиска по составному ключу
      for (const record of existingRecords) {
        const key = `${record.nm_id}|${record.ts_name}`
        existingMap.set(key, record)
      }

      // Подсчитываем quantity до сохранения для этой даты
      const dateQuantityBeforeSave = dateSales.reduce((sum, s) => sum + (s.quantity || 0), 0)
      console.log(`[ReportSaleRepository] Дата ${date}: сохраняем ${dateSales.length} записей, общее quantity=${dateQuantityBeforeSave}`)

      for (const sale of dateSales) {
        const key = `${sale.nm_id}|${sale.ts_name}`
        const existing = existingMap.get(key)

        if (existing) {
          // Обновляем существующую запись, суммируя числовые поля
          // retail_price берем из новой записи, если она не равна 0 или если в существующей 0
          const oldQuantity = existing.quantity || 0
          const newQuantity = sale.quantity || 0
          // operation_type: приоритет "Продаже" при обновлении
          let operationType = existing.operation_type || sale.operation_type
          if (sale.operation_type === 'Продажа') {
            operationType = 'Продажа'
          } else if (!existing.operation_type && sale.operation_type) {
            operationType = sale.operation_type
          }

          const updated: ReportSale = {
            ...existing,
            quantity: oldQuantity + newQuantity,
            retail_price: (existing.retail_price || 0) + (sale.retail_price || 0),
            retail_amount: (existing.retail_amount || 0) + (sale.retail_amount || 0),
            delivery_amount: (existing.delivery_amount || 0) + (sale.delivery_amount || 0),
            return_amount: (existing.return_amount || 0) + (sale.return_amount || 0),
            delivery_rub: (existing.delivery_rub || 0) + (sale.delivery_rub || 0),
            ppvz_for_pay: (existing.ppvz_for_pay || 0) + (sale.ppvz_for_pay || 0),
            penalty: (existing.penalty || 0) + (sale.penalty || 0),
            additional_payment: (existing.additional_payment || 0) + (sale.additional_payment || 0),
            operation_type: operationType,
          }
          console.log(`[ReportSaleRepository] Обновление записи ${key} (${date}): quantity ${oldQuantity} + ${newQuantity} = ${updated.quantity}`)
          // Удаляем из existingMap, чтобы не обрабатывать повторно
          existingMap.delete(key)
          toUpdate.push(updated)
        } else {
          // Новая запись
          console.log(`[ReportSaleRepository] Новая запись ${key} (${date}): quantity=${sale.quantity}`)
          toAdd.push(sale as ReportSale)
        }
      }
      
      // Проверяем, не осталось ли записей в existingMap, которые должны были быть обновлены
      if (existingMap.size > 0) {
        console.log(`[ReportSaleRepository] ⚠️ Дата ${date}: осталось ${existingMap.size} записей в existingMap, которые не были обработаны`)
      }
    }

    // Подсчитываем итоговое quantity после всех операций
    const totalQuantityAfter = toUpdate.reduce((sum, s) => sum + (s.quantity || 0), 0) + 
                               toAdd.reduce((sum, s) => sum + (s.quantity || 0), 0)
    console.log(`[ReportSaleRepository] К обновлению: ${toUpdate.length}, к добавлению: ${toAdd.length}`)
    console.log(`[ReportSaleRepository] Quantity: было до сохранения=${totalQuantity}, будет после сохранения=${totalQuantityAfter}`)

    // Обновляем существующие записи
    if (toUpdate.length > 0) {
      await db.sales.bulkPut(toUpdate)
    }

    // Добавляем новые записи
    if (toAdd.length > 0) {
      await db.sales.bulkAdd(toAdd)
    }

    return toUpdate.length + toAdd.length
  }

  async clear(): Promise<void> {
    await db.sales.clear()
  }

  async getByDateRange(from: string, to: string): Promise<ReportSale[]> {
    return await db.sales
      .where('rr_dt')
      .between(from, to, true, true)
      .toArray()
  }
}
