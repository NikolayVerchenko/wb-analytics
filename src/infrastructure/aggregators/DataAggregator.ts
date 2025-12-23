import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'
import type { RawReportItem } from '@infrastructure/mappers/ReportDataMapper'

export interface AggregatedSale extends Omit<ReportSale, 'rr_dt'> {
  rr_dt: string // Только дата (YYYY-MM-DD)
}

export interface AggregatedReturn extends Omit<ReportReturn, 'rr_dt'> {
  rr_dt: string // Только дата (YYYY-MM-DD)
}

/**
 * Класс для агрегации данных финансовых отчетов
 * Группирует данные по составному ключу: дата + артикул + размер
 */
export class DataAggregator {
  /**
   * Извлекает только дату из строки даты/времени
   */
  private extractDate(dateTime: string): string {
    // Если формат уже YYYY-MM-DD, возвращаем как есть
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) {
      return dateTime
    }
    // Если формат ISO с временем, извлекаем дату
    return dateTime.split('T')[0]
  }

  /**
   * Создает составной ключ для группировки
   */
  private createCompositeKey(item: RawReportItem): string {
    const date = this.extractDate(item.rr_dt)
    return `${date}|${item.nm_id}|${item.ts_name}`
  }

  /**
   * Агрегирует массив сырых данных по составному ключу
   * ВАЖНО: Разделяем данные на sales и returns ДО агрегации, чтобы не потерять информацию о возвратах
   */
  aggregate(rawData: RawReportItem[]): {
    aggregated: Map<string, RawReportItem>
  } {
    const aggregated = new Map<string, RawReportItem>()
    
    // Подсчитываем количество записей по типам операций до агрегации
    let salesRecordsCount = 0
    let returnsRecordsCount = 0
    const uniqueSalesKeys = new Set<string>()
    const uniqueReturnsKeys = new Set<string>()

    for (const item of rawData) {
      // Определяем, является ли это возвратом (по supplier_oper_name)
      // Возврат: supplier_oper_name === "Возврат" (точное совпадение)
      // Продажа: supplier_oper_name !== "Возврат" (все остальное)
      const isReturn = item.supplier_oper_name === 'Возврат'

      // Ключ агрегации включает тип операции (sales/returns), чтобы не смешивать возвраты с продажами
      // Это критично, так как возвраты и продажи с одинаковым nm_id и ts_name не должны агрегироваться вместе
      const operationType = isReturn ? 'return' : 'sale'
      const key = `${this.createCompositeKey(item)}|${operationType}`
      
      // Подсчитываем записи по типам
      if (isReturn) {
        returnsRecordsCount++
        uniqueReturnsKeys.add(key)
      } else {
        salesRecordsCount++
        uniqueSalesKeys.add(key)
      }
      
      const existing = aggregated.get(key)

      if (!existing) {
        // Первая запись группы - сохраняем как есть
        // Поля-атрибуты (gi_id, subject_name, brand_name, sa_name, supplier_oper_name) берутся из первой строки
        aggregated.set(key, { ...item })
        
        // Если это не продажа/возврат/сторно, обнуляем quantity для первой записи,
        // чтобы оно не учитывалось в общем количестве штук, но финансовые поля сохраняем
        const isStorno = item.supplier_oper_name.toLowerCase().includes('сторно')
        if (item.supplier_oper_name !== 'Продажа' && item.supplier_oper_name !== 'Возврат' && !isStorno) {
          const entry = aggregated.get(key)!
          entry.quantity = 0
        }
      } else {
        // Агрегируем только числовые поля (суммируем)
        
        // quantity суммируем только для фактических продаж, возвратов и сторно
        const isStorno = item.supplier_oper_name.toLowerCase().includes('сторно')
        if (item.supplier_oper_name === 'Продажа' || item.supplier_oper_name === 'Возврат' || isStorno) {
        existing.quantity = (existing.quantity || 0) + (item.quantity || 0)
        }

        existing.retail_amount = (existing.retail_amount || 0) + (item.retail_amount || 0)
        existing.delivery_amount = (existing.delivery_amount || 0) + (item.delivery_amount || 0)
        existing.return_amount = (existing.return_amount || 0) + (item.return_amount || 0)
        existing.delivery_rub = (existing.delivery_rub || 0) + (item.delivery_rub || 0)
        existing.ppvz_for_pay = (existing.ppvz_for_pay || 0) + (item.ppvz_for_pay || 0)
        existing.penalty = (existing.penalty || 0) + (item.penalty || 0)
        existing.additional_payment =
          (existing.additional_payment || 0) + (item.additional_payment || 0)
        // Сохраняем storage_fee при агрегации
        existing.storage_fee = (existing.storage_fee || 0) + (item.storage_fee || 0)

        // operation_type (supplier_oper_name): приоритет "Продаже"
        // Если в существующей записи не "Продажа", но в новой записи "Продажа" - обновляем
        // Иначе сохраняем существующее значение
        if (!isReturn && item.supplier_oper_name === 'Продажа') {
          existing.supplier_oper_name = 'Продажа'
        } else if (!existing.supplier_oper_name && item.supplier_oper_name) {
          existing.supplier_oper_name = item.supplier_oper_name
        }

        // retail_price: если в существующей записи = 0, но в новой есть значение, обновляем
        // Или вычисляем как retail_amount / quantity, если оба не равны 0
        if ((!existing.retail_price || existing.retail_price === 0) && item.retail_price && item.retail_price > 0) {
          existing.retail_price = item.retail_price
        } else if ((!existing.retail_price || existing.retail_price === 0) && existing.quantity > 0 && existing.retail_amount > 0) {
          // Вычисляем retail_price как среднюю цену за единицу
          existing.retail_price = existing.retail_amount / existing.quantity
        }
      }
    }
    
    // Подсчитываем общее количество quantity для продаж и возвратов (только реальные штуки)
    let totalSalesQuantity = 0
    let totalReturnsQuantity = 0
    for (const item of rawData) {
      const isReturn = item.supplier_oper_name === 'Возврат'
      const isStorno = (item.supplier_oper_name || '').toLowerCase().includes('сторно')
      const isSale = item.supplier_oper_name === 'Продажа'
      
      const quantity = item.quantity || 0
      
      if (isReturn) {
        totalReturnsQuantity += quantity
      } else if (isSale || isStorno) {
        totalSalesQuantity += quantity
      }
    }
    
    // Подсчитываем quantity после агрегации
    let aggregatedSalesQuantity = 0
    let aggregatedReturnsQuantity = 0
    for (const item of aggregated.values()) {
      // Возврат: supplier_oper_name === "Возврат" (точное совпадение)
      // Продажа: supplier_oper_name !== "Возврат" (все остальное)
      const isReturn = item.supplier_oper_name === 'Возврат'
      if (isReturn) {
        aggregatedReturnsQuantity += item.quantity || 0
      } else {
        aggregatedSalesQuantity += item.quantity || 0
      }
    }
    
    // Отладочное логирование
    console.log(`[DataAggregator] Агрегация: всего записей=${rawData.length}, продаж=${salesRecordsCount}, возвратов=${returnsRecordsCount}`)
    console.log(`[DataAggregator] Quantity до агрегации: продаж=${totalSalesQuantity}, возвратов=${totalReturnsQuantity}`)
    console.log(`[DataAggregator] Уникальных ключей: продаж=${uniqueSalesKeys.size}, возвратов=${uniqueReturnsKeys.size}`)
    console.log(`[DataAggregator] После агрегации: уникальных записей=${aggregated.size}`)
    console.log(`[DataAggregator] Quantity после агрегации: продаж=${aggregatedSalesQuantity}, возвратов=${aggregatedReturnsQuantity}`)

    return { aggregated }
  }

  /**
   * Преобразует агрегированные данные в формат для сохранения
   */
  convertToEntities(aggregated: Map<string, RawReportItem>): {
    sales: AggregatedSale[]
    returns: AggregatedReturn[]
  } {
    const sales: AggregatedSale[] = []
    const returns: AggregatedReturn[] = []
    
    const supplierOperNames = new Set<string>()

    for (const item of aggregated.values()) {
      // Собираем уникальные значения supplier_oper_name для отладки
      if (item.supplier_oper_name) {
        supplierOperNames.add(item.supplier_oper_name)
      }
      const baseEntity = {
        gi_id: item.gi_id,
        subject_name: item.subject_name,
        nm_id: item.nm_id,
        brand_name: item.brand_name,
        sa_name: item.sa_name,
        ts_name: item.ts_name,
        quantity: item.quantity,
        retail_price: item.retail_price,
        retail_amount: item.retail_amount,
        rr_dt: this.extractDate(item.rr_dt), // Только дата
        delivery_amount: item.delivery_amount,
        return_amount: item.return_amount,
        delivery_rub: item.delivery_rub,
        ppvz_for_pay: item.ppvz_for_pay,
        bonus_type_name: item.bonus_type_name,
        penalty: item.penalty,
        additional_payment: item.additional_payment,
        operation_type: item.supplier_oper_name, // Сохраняем тип операции для sales
      }

      // Логика разделения на sales и returns:
      // Поток Возвратов: supplier_oper_name === "Возврат" (точное совпадение)
      // Поток Продаж: supplier_oper_name !== "Возврат" (все остальное)
      // 
      // Важно: Все возвраты идут в таблицу returns,
      // так как это физические возвраты товара от клиентов
      
      const isReturn = item.supplier_oper_name === 'Возврат'
      
      if (isReturn) {
        // Все возвраты -> в returns
        returns.push(baseEntity as AggregatedReturn)
      } else {
        // Все остальное (продажи, другие операции) -> in sales
        sales.push(baseEntity as AggregatedSale)
      }
    }

    return { sales, returns }
  }

  /**
   * Полный цикл: агрегация + преобразование в сущности
   */
  process(rawData: RawReportItem[]): {
    sales: AggregatedSale[]
    returns: AggregatedReturn[]
  } {
    const { aggregated } = this.aggregate(rawData)
    return this.convertToEntities(aggregated)
  }
}
