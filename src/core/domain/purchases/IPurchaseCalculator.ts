import type { IPurchaseItem, IPurchase } from '../../../types/db'
import type { ItemCostCalculation, PurchaseSummary } from './types'

/**
 * Интерфейс калькулятора для расчётов по закупкам
 */
export interface IPurchaseCalculator {
  /**
   * Рассчитывает себестоимость единицы товара в RUB
   */
  calculateItemCost(item: IPurchaseItem, purchase: IPurchase): ItemCostCalculation

  /**
   * Рассчитывает общий вес партии в кг
   */
  calculateTotalWeight(items: IPurchaseItem[]): number

  /**
   * Рассчитывает суммарные показатели закупки
   */
  calculateSummary(purchase: IPurchase): PurchaseSummary

  /**
   * Распределяет общую логистику до Москвы на товары
   * @returns Map где ключ: `${nmID}_${techSize}`, значение: доля в RUB
   */
  distributeLogisticsToMoscow(
    logisticsToMoscow: number,
    items: IPurchaseItem[]
  ): Map<string, number>

  /**
   * Рассчитывает общую стоимость закупки в RUB
   * Использует calculateItemCost для каждого товара - не дублирует формулу
   */
  calculatePurchaseTotalRUB(purchase: IPurchase): number
}
