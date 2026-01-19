import type { IPurchaseCalculator } from '../../core/domain/purchases/IPurchaseCalculator'
import type { IPurchaseItem, IPurchase } from '../../types/db'
import type { ItemCostCalculation, PurchaseSummary } from '../../core/domain/purchases/types'

/**
 * Реализация калькулятора для расчётов по закупкам
 */
export class PurchaseCalculator implements IPurchaseCalculator {
  /**
   * Рассчитывает себестоимость единицы товара в RUB
   */
  calculateItemCost(item: IPurchaseItem, purchase: IPurchase): ItemCostCalculation {
    if (!purchase.exchangeRate || !item.quantity || item.quantity <= 0) {
      return {
        costPerUnit: 0,
        breakdown: {
          priceWithCommission: 0,
          logisticsCNY: 0,
          logisticsToMoscow: 0,
          fulfillment: 0,
          packaging: 0,
          kiz: 0,
        },
      }
    }

    // Цена в CNY с учетом комиссии байера
    const priceWithCommission = item.priceCNY * (1 + purchase.buyerCommissionPercent / 100)

    // Логистика по Китаю в CNY с учетом комиссии
    // Логистика указана на все количество в артикуле, поэтому делим на общее количество товаров в артикуле
    const totalQuantityInArticle = purchase.items
      .filter(i => i.nmID === item.nmID)
      .reduce((sum, i) => sum + (i.quantity || 0), 0)
    const logisticsPerUnit = totalQuantityInArticle > 0 
      ? item.logisticsCNY / totalQuantityInArticle 
      : 0
    const logisticsWithCommission = logisticsPerUnit * (1 + purchase.buyerCommissionPercent / 100)

    // Общая логистика до Москвы распределяется пропорционально весу товаров
    const totalWeight = purchase.items.reduce((sum, i) => {
      const weightPerUnit = i.weightPerUnit || 0
      return sum + weightPerUnit * (i.quantity || 0)
    }, 0)
    
    const itemWeight = (item.weightPerUnit || 0) * (item.quantity || 0)
    const logisticsForItem = totalWeight > 0 && itemWeight > 0
      ? (purchase.logisticsToMoscow * itemWeight) / totalWeight
      : 0
    const logisticsPerItem = (item.quantity || 0) > 0 ? logisticsForItem / (item.quantity || 0) : 0

    // Себестоимость в RUB
    const costInRUB =
      (priceWithCommission + logisticsWithCommission) * purchase.exchangeRate +
      item.fulfillmentRUB +
      item.packagingRUB +
      item.kizRUB +
      logisticsPerItem

    return {
      costPerUnit: costInRUB,
      breakdown: {
        priceWithCommission: priceWithCommission * purchase.exchangeRate,
        logisticsCNY: logisticsWithCommission * purchase.exchangeRate,
        logisticsToMoscow: logisticsPerItem,
        fulfillment: item.fulfillmentRUB,
        packaging: item.packagingRUB,
        kiz: item.kizRUB,
      },
    }
  }

  /**
   * Рассчитывает общий вес партии в кг
   */
  calculateTotalWeight(items: IPurchaseItem[]): number {
    return items.reduce((sum, item) => {
      const weightPerUnit = item.weightPerUnit || 0
      return sum + weightPerUnit * (item.quantity || 0)
    }, 0)
  }

  /**
   * Рассчитывает суммарные показатели закупки
   */
  calculateSummary(purchase: IPurchase): PurchaseSummary {
    const totalWeight = this.calculateTotalWeight(purchase.items)
    const totalItems = purchase.items.length
    const totalQuantity = purchase.items.reduce((sum, item) => sum + (item.quantity || 0), 0)

    return {
      totalWeight,
      totalItems,
      totalQuantity,
    }
  }

  /**
   * Распределяет общую логистику до Москвы на товары пропорционально весу
   */
  distributeLogisticsToMoscow(
    logisticsToMoscow: number,
    items: IPurchaseItem[]
  ): Map<string, number> {
    const distribution = new Map<string, number>()
    
    // Вычисляем общий вес всех товаров
    const totalWeight = items.reduce((sum, i) => {
      const weightPerUnit = i.weightPerUnit || 0
      return sum + weightPerUnit * (i.quantity || 0)
    }, 0)
    
    // Распределяем логистику пропорционально весу каждого товара
    for (const item of items) {
      const itemWeight = (item.weightPerUnit || 0) * (item.quantity || 0)
      const logisticsForItem = totalWeight > 0 && itemWeight > 0
        ? (logisticsToMoscow * itemWeight) / totalWeight
        : 0
      const logisticsPerItem = (item.quantity || 0) > 0 ? logisticsForItem / (item.quantity || 0) : 0
      
      const key = `${item.nmID}_${item.techSize}`
      distribution.set(key, logisticsPerItem)
    }

    return distribution
  }

  /**
   * Рассчитывает общую стоимость закупки в RUB
   * Использует calculateItemCost для каждого товара - не дублирует формулу
   */
  calculatePurchaseTotalRUB(purchase: IPurchase): number {
    return purchase.items.reduce((sum, item) => {
      const cost = this.calculateItemCost(item, purchase)
      return sum + cost.costPerUnit * (item.quantity || 0)
    }, 0)
  }
}
