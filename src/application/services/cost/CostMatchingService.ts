/**
 * Сервис сопоставления себестоимости продаж с поставками
 */

import type { ISale, ISupply } from '@/types/db'
import type {
  SaleCostMatch,
  CostMatchStats,
  MatchOptions,
  CostSource,
  CostReason,
} from './types'
import { normalizeSize, makeItemKey, makeSaleKey, normalizeId } from './costKey'
import {
  buildSupplyIndex,
  buildApproxIndex,
  type SupplyIndex,
  type ApproxIndex,
} from './SupplyCostIndexBuilder'

/**
 * Сервис сопоставления себестоимости
 */
export class CostMatchingService {
  constructor(
    private readonly index: SupplyIndex,
    private readonly approxIndex?: ApproxIndex
  ) {}

  /**
   * Создает сервис из массива поставок
   * 
   * @param supplies - Массив поставок
   * @param opts - Опции построения индексов
   * @returns Сервис сопоставления
   */
  static fromSupplies(
    supplies: ISupply[],
    opts?: { buildApprox?: boolean }
  ): CostMatchingService {
    const index = buildSupplyIndex(supplies)
    const approxIndex = opts?.buildApprox ? buildApproxIndex(supplies) : undefined
    return new CostMatchingService(index, approxIndex)
  }

  /**
   * Сопоставляет продажи с себестоимостью из поставок
   * 
   * @param sales - Массив продаж
   * @param options - Опции сопоставления
   * @returns Результаты сопоставления и статистика
   */
  matchSales(
    sales: ISale[],
    options?: MatchOptions
  ): { matches: SaleCostMatch[]; stats: CostMatchStats } {
    const mode = options?.mode || 'STRICT'
    const matches: SaleCostMatch[] = []

    // Инициализируем статистику
    const stats: CostMatchStats = {
      totalSales: sales.length,
      matched: 0,
      byReason: {
        OK: 0,
        NO_GI_ID: 0,
        SUPPLY_NOT_FOUND: 0,
        ITEM_NOT_FOUND: 0,
        COST_EMPTY: 0,
        SIZE_EMPTY: 0,
        APPROX_FROM_OTHER_SUPPLY: 0,
      },
    }

    for (const sale of sales) {
      const match = this.matchSale(sale, mode, options?.useDateHeuristic)
      matches.push(match)

      // Обновляем статистику
      stats.byReason[match.reason]++
      if (match.reason === 'OK') {
        stats.matched++
      }
    }

    return { matches, stats }
  }

  /**
   * Сопоставляет одну продажу с себестоимостью
   */
  private matchSale(
    sale: ISale,
    mode: 'STRICT' | 'STRICT_WITH_APPROX',
    useDateHeuristic?: boolean
  ): SaleCostMatch {
    // Создаем базовый результат
    const saleKey = makeSaleKey(sale.ni, sale.dt, sale.sz)
    const baseMatch: SaleCostMatch = {
      pk: sale.pk,
      saleKey,
      ni: sale.ni,
      sz: sale.sz || '',
      qt: sale.qt || 0,
      gi_id: sale.gi_id,
      costPerUnit: 0,
      costTotal: 0,
      source: 'NONE' as CostSource,
      reason: 'OK' as CostReason,
    }

    // 1. Проверка размера (ПЕРВЫЙ ПРОВЕРКА)
    const normalizedSize = normalizeSize(sale.sz)
    if (normalizedSize === '') {
      return {
        ...baseMatch,
        reason: 'SIZE_EMPTY',
        source: 'NONE',
      }
    }

    // 2. Проверка gi_id
    const giId = normalizeId(sale.gi_id)
    if (!giId) {
      return {
        ...baseMatch,
        reason: 'NO_GI_ID',
        source: 'NONE',
      }
    }

    // 3. Поиск поставки в индексе
    const bucket = this.index.bySupplyId.get(giId)
    if (!bucket) {
      // Попытка APPROX если режим включен
      if (mode === 'STRICT_WITH_APPROX' && this.approxIndex) {
        const approxResult = this.tryApprox(sale, normalizedSize, useDateHeuristic)
        if (approxResult) {
          return approxResult
        }
      }
      return {
        ...baseMatch,
        reason: 'SUPPLY_NOT_FOUND',
        source: 'NONE',
      }
    }

    // 4. Построение ключа товара (с нормализацией)
    const itemKey = makeItemKey(sale.ni, normalizedSize)

    // 5. Проверка наличия товара в поставке
    if (!bucket.existsKeys.has(itemKey)) {
      // Попытка APPROX если режим включен
      if (mode === 'STRICT_WITH_APPROX' && this.approxIndex) {
        const approxResult = this.tryApprox(sale, normalizedSize, useDateHeuristic)
        if (approxResult) {
          return approxResult
        }
      }
      return {
        ...baseMatch,
        reason: 'ITEM_NOT_FOUND',
        source: 'NONE',
      }
    }

    // 6. Проверка наличия себестоимости
    const costPerUnit = bucket.costByKey.get(itemKey)
    if (costPerUnit === undefined) {
      // Попытка APPROX если режим включен
      if (mode === 'STRICT_WITH_APPROX' && this.approxIndex) {
        const approxResult = this.tryApprox(sale, normalizedSize, useDateHeuristic)
        if (approxResult) {
          return approxResult
        }
      }
      return {
        ...baseMatch,
        reason: 'COST_EMPTY',
        source: 'NONE',
        matchedSupplyId: giId,
        matchedItemKey: itemKey,
      }
    }

    // 7. Успешное сопоставление
    const quantity = sale.qt || 0
    return {
      ...baseMatch,
      costPerUnit,
      costTotal: costPerUnit * quantity,
      reason: 'OK',
      source: 'SUPPLY_MATCH',
      matchedSupplyId: giId,
      matchedItemKey: makeItemKey(sale.ni, normalizedSize),
    }
  }

  /**
   * Попытка найти себестоимость через APPROX режим
   */
  private tryApprox(
    sale: ISale,
    normalizedSize: string,
    useDateHeuristic?: boolean
  ): SaleCostMatch | null {
    if (!this.approxIndex) return null

    const itemKey = makeItemKey(sale.ni, normalizedSize)
    const candidates = this.approxIndex.byItemKey.get(itemKey)

    if (!candidates || candidates.length === 0) {
      return null
    }

    // Выбор кандидата по дате (если включена эвристика)
    let selected = candidates[0]
    if (useDateHeuristic) {
      // Выбираем поставку с date <= sale.dt и максимальной date
      const validCandidates = candidates.filter((c) => c.date <= sale.dt)
      if (validCandidates.length > 0) {
        selected = validCandidates.reduce((best, current) => {
          return current.date > best.date ? current : best
        }, validCandidates[0])
      }
    }

    // Используем последнюю известную (первую в массиве или выбранную по дате)
    const quantity = sale.qt || 0
    const saleKey = makeSaleKey(sale.ni, sale.dt, sale.sz)

    return {
      pk: sale.pk,
      saleKey,
      ni: sale.ni,
      sz: sale.sz || '',
      qt: quantity,
      gi_id: sale.gi_id,
      costPerUnit: selected.cost,
      costTotal: selected.cost * quantity,
      reason: 'APPROX_FROM_OTHER_SUPPLY',
      source: 'APPROX',
      matchedSupplyId: selected.supplyId,
      matchedItemKey: itemKey,
    }
  }
}
