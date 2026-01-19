/**
 * Типы для сервиса сопоставления себестоимости продаж с поставками
 */

export type CostSource = 'SUPPLY_MATCH' | 'APPROX' | 'NONE'

export type CostReason =
  | 'OK'
  | 'NO_GI_ID'
  | 'SUPPLY_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'COST_EMPTY'
  | 'SIZE_EMPTY'
  | 'APPROX_FROM_OTHER_SUPPLY'

/**
 * Результат сопоставления себестоимости для одной продажи
 */
export interface SaleCostMatch {
  pk?: string // Primary key продажи (если есть в ISale)
  saleKey: string // Универсальный ключ для lookup (${ni}*${dt}*${normalizeSize(sz)})
  ni: number // Артикул WB
  sz: string // Размер товара
  qt: number // Количество
  gi_id?: number | null // ID поставки

  costPerUnit: number // Себестоимость за единицу (RUB)
  costTotal: number // Себестоимость общая (RUB)

  source: CostSource // Источник себестоимости
  reason: CostReason // Причина результата сопоставления

  matchedSupplyId?: number // ID поставки, в которой найден товар
  matchedItemKey?: string // Ключ найденного товара (nmID|size)
}

/**
 * Статистика сопоставления себестоимости
 */
export interface CostMatchStats {
  totalSales: number // Всего продаж обработано
  matched: number // Продаж с найденной себестоимостью (reason === 'OK')
  byReason: Record<CostReason, number> // Счетчики по причинам
}

/**
 * Опции сопоставления себестоимости
 */
export interface MatchOptions {
  mode: 'STRICT' | 'STRICT_WITH_APPROX' // Режим сопоставления
  useDateHeuristic?: boolean // Использовать эвристику по дате для APPROX режима
}
