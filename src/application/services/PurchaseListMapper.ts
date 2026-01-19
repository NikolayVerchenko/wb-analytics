import type { IPurchase } from '../../types/db'
import type { PurchaseListRow } from '../../types/purchases'
import { PurchaseCalculator } from '../purchases/PurchaseCalculator'

/**
 * Сервис преобразования IPurchase в PurchaseListRow для отображения в таблице
 */
export class PurchaseListMapper {
  private calculator: PurchaseCalculator

  constructor() {
    this.calculator = new PurchaseCalculator()
  }

  /**
   * Преобразует IPurchase в PurchaseListRow
   */
  toListRow(purchase: IPurchase): PurchaseListRow {
    // Подсчет уникальных товаров (по nmID)
    const uniqueItems = new Set(purchase.items.map(item => item.nmID))
    const itemsCount = uniqueItems.size

    // Общее количество товаров
    const totalQuantity = purchase.items.reduce((sum, item) => sum + (item.quantity || 0), 0)

    // Итоговая сумма в рублях
    const totalRUB = this.calculator.calculatePurchaseTotalRUB(purchase)

    return {
      id: purchase.id!,
      date: purchase.date,
      orderNumber: purchase.orderNumber,
      status: purchase.status,
      itemsCount,
      totalQuantity,
      totalRUB,
    }
  }

  /**
   * Преобразует массив IPurchase в массив PurchaseListRow
   */
  toListRows(purchases: IPurchase[]): PurchaseListRow[] {
    return purchases.map(purchase => this.toListRow(purchase))
  }
}
