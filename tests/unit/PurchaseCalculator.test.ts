import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PurchaseCalculator } from '../../src/application/purchases/PurchaseCalculator'
import type { IPurchaseItem, IPurchase } from '../../src/types/db'

describe('PurchaseCalculator', () => {
  let calculator: PurchaseCalculator

  beforeEach(() => {
    calculator = new PurchaseCalculator()
  })

  describe('calculateItemCost', () => {
    it('should calculate cost with commission and logistics', () => {
      const item: IPurchaseItem = {
        nmID: 123,
        vendorCode: 'ABC',
        techSize: 'M',
        priceCNY: 100,
        logisticsCNY: 10,
        fulfillmentRUB: 50,
        packagingRUB: 20,
        kizRUB: 5,
        quantity: 2,
      }

      const purchase: IPurchase = {
        date: '2024-01-01',
        orderNumber: 'ORD-001',
        status: 'pending',
        exchangeRate: 12.5,
        buyerCommissionPercent: 5,
        logisticsToMoscow: 1000,
        items: [item],
      }

      const result = calculator.calculateItemCost(item, purchase)
      expect(result.costPerUnit).toBeGreaterThan(0)
      expect(result.breakdown.priceWithCommission).toBe(100 * 1.05 * 12.5)
      expect(result.breakdown.logisticsCNY).toBe(10 * 1.05 * 12.5)
      expect(result.breakdown.fulfillment).toBe(50)
      expect(result.breakdown.packaging).toBe(20)
      expect(result.breakdown.kiz).toBe(5)
    })

    it('should return zero cost for invalid item', () => {
      const item: IPurchaseItem = {
        nmID: 123,
        vendorCode: 'ABC',
        techSize: 'M',
        quantity: 0,
        priceCNY: 0,
        logisticsCNY: 0,
        fulfillmentRUB: 0,
        packagingRUB: 0,
        kizRUB: 0,
      }

      const purchase: IPurchase = {
        date: '2024-01-01',
        orderNumber: 'ORD-001',
        status: 'pending',
        exchangeRate: 0,
        buyerCommissionPercent: 0,
        logisticsToMoscow: 0,
        items: [item],
      }

      const result = calculator.calculateItemCost(item, purchase)
      expect(result.costPerUnit).toBe(0)
    })
  })

  describe('calculateTotalWeight', () => {
    it('should sum weights of all items', () => {
      const items: IPurchaseItem[] = [
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'M',
          weightPerUnit: 0.5,
          quantity: 2,
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
        {
          nmID: 456,
          vendorCode: 'DEF',
          techSize: 'L',
          weightPerUnit: 1.0,
          quantity: 1,
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
      ]
      expect(calculator.calculateTotalWeight(items)).toBe(2.0)
    })

    it('should return 0 for empty array', () => {
      expect(calculator.calculateTotalWeight([])).toBe(0)
    })
  })

  describe('calculateSummary', () => {
    it('should calculate summary correctly', () => {
      const purchase: IPurchase = {
        date: '2024-01-01',
        orderNumber: 'ORD-001',
        status: 'pending',
        exchangeRate: 12.5,
        buyerCommissionPercent: 5,
        logisticsToMoscow: 1000,
        items: [
          {
            nmID: 123,
            vendorCode: 'ABC',
            techSize: 'M',
            weightPerUnit: 0.5,
            quantity: 2,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 456,
            vendorCode: 'DEF',
            techSize: 'L',
            weightPerUnit: 1.0,
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
        ],
      }

      const summary = calculator.calculateSummary(purchase)
      expect(summary.totalItems).toBe(2)
      expect(summary.totalQuantity).toBe(3)
      expect(summary.totalWeight).toBe(2.0)
    })
  })

  describe('distributeLogisticsToMoscow', () => {
    it('should distribute logistics proportionally by weight', () => {
      const items: IPurchaseItem[] = [
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'M',
          quantity: 2,
          weightPerUnit: 0.5, // Общий вес: 0.5 * 2 = 1.0 кг
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
        {
          nmID: 456,
          vendorCode: 'DEF',
          techSize: 'L',
          quantity: 1,
          weightPerUnit: 1.0, // Общий вес: 1.0 * 1 = 1.0 кг
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
      ]

      // Общий вес: 1.0 + 1.0 = 2.0 кг
      // Логистика: 300 ₽
      // Товар 1 (1.0 кг): 300 * (1.0 / 2.0) = 150 ₽, на единицу: 150 / 2 = 75 ₽
      // Товар 2 (1.0 кг): 300 * (1.0 / 2.0) = 150 ₽, на единицу: 150 / 1 = 150 ₽
      const distribution = calculator.distributeLogisticsToMoscow(300, items)
      expect(distribution.get('123_M')).toBe(75) // 150 / 2 = 75 per item
      expect(distribution.get('456_L')).toBe(150) // 150 / 1 = 150 per item
    })

    it('should handle items with different weights correctly', () => {
      const items: IPurchaseItem[] = [
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'M',
          quantity: 1,
          weightPerUnit: 0.2, // Общий вес: 0.2 * 1 = 0.2 кг
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
        {
          nmID: 456,
          vendorCode: 'DEF',
          techSize: 'L',
          quantity: 1,
          weightPerUnit: 0.8, // Общий вес: 0.8 * 1 = 0.8 кг
          priceCNY: 0,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
      ]

      // Общий вес: 0.2 + 0.8 = 1.0 кг
      // Логистика: 1000 ₽
      // Товар 1 (0.2 кг): 1000 * (0.2 / 1.0) = 200 ₽, на единицу: 200 / 1 = 200 ₽
      // Товар 2 (0.8 кг): 1000 * (0.8 / 1.0) = 800 ₽, на единицу: 800 / 1 = 800 ₽
      const distribution = calculator.distributeLogisticsToMoscow(1000, items)
      expect(distribution.get('123_M')).toBe(200)
      expect(distribution.get('456_L')).toBe(800)
    })
  })
})
