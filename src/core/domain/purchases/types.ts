import type { IPurchaseItem } from '../../../types/db'

/**
 * Группированный товар для отображения (по nmID)
 */
export interface GroupedPurchase {
  nmID: number
  title: string
  vendorCode: string
  img: string | null
  color: string
  items: IPurchaseItem[]
  totalQuantity: number
}

/**
 * Сводные показатели закупки
 */
export interface PurchaseSummary {
  totalWeight: number // кг
  totalItems: number
  totalQuantity: number
}

/**
 * Детализация расчёта себестоимости единицы товара
 */
export interface ItemCostCalculation {
  costPerUnit: number // RUB
  breakdown: {
    priceWithCommission: number
    logisticsCNY: number
    logisticsToMoscow: number
    fulfillment: number
    packaging: number
    kiz: number
  }
}
