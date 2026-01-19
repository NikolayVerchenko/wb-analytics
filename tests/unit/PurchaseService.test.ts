import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PurchaseService } from '../../src/application/purchases/PurchaseService'
import type { IPurchaseRepository } from '../../src/core/domain/purchases/IPurchaseRepository'
import type { IPurchaseCalculator } from '../../src/core/domain/purchases/IPurchaseCalculator'
import type { IPurchasePrefillService } from '../../src/core/domain/purchases/IPurchasePrefillService'
import type { IPurchase, IPurchaseItem } from '../../src/types/db'

const createMockPurchase = (): IPurchase => ({
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
      quantity: 2,
      priceCNY: 100,
      logisticsCNY: 10,
      fulfillmentRUB: 50,
      packagingRUB: 20,
      kizRUB: 5,
    },
  ],
})

describe('PurchaseService', () => {
  let mockRepository: any
  let mockCalculator: any
  let mockPrefillService: any
  let service: PurchaseService

  beforeEach(() => {
    mockRepository = {
      getAll: vi.fn(),
      getById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByDateRange: vi.fn(),
    }

    mockCalculator = {
      calculateItemCost: vi.fn(),
      calculateTotalWeight: vi.fn(),
      calculateSummary: vi.fn(),
      distributeLogisticsToMoscow: vi.fn(),
    }

    mockPrefillService = {
      createItemsFromProduct: vi.fn(),
    }

    service = new PurchaseService(mockRepository, mockCalculator, mockPrefillService)
  })

  describe('savePurchase', () => {
    it('should save purchase through repository', async () => {
      const purchase = createMockPurchase()
      mockRepository.save.mockResolvedValue(1)

      const id = await service.savePurchase(purchase)

      expect(mockRepository.save).toHaveBeenCalledWith(purchase)
      expect(id).toBe(1)
    })

    it('should throw error for invalid purchase', async () => {
      const purchase = {
        ...createMockPurchase(),
        date: '',
        orderNumber: '',
      }

      await expect(service.savePurchase(purchase)).rejects.toThrow()
    })

    it('should throw error for purchase without items', async () => {
      const purchase = {
        ...createMockPurchase(),
        items: [],
      }

      await expect(service.savePurchase(purchase)).rejects.toThrow()
    })
  })

  describe('removeGroup', () => {
    it('should remove all items with given nmID', () => {
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
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 123,
            vendorCode: 'ABC',
            techSize: 'L',
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 456,
            vendorCode: 'DEF',
            techSize: 'M',
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
        ],
      }

      const result = service.removeGroup(purchase, 123)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].nmID).toBe(456)
    })
  })

  describe('removeItem', () => {
    it('should remove specific item by nmID and techSize', () => {
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
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 123,
            vendorCode: 'ABC',
            techSize: 'L',
            quantity: 1,
            priceCNY: 0,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
        ],
      }

      const result = service.removeItem(purchase, 123, 'M')

      expect(result.items).toHaveLength(1)
      expect(result.items[0].techSize).toBe('L')
    })
  })

  describe('getGroupValue', () => {
    it('should return first non-zero value for group', () => {
      const items: IPurchaseItem[] = [
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'M',
          priceCNY: 0,
          quantity: 1,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'L',
          priceCNY: 100,
          quantity: 1,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
      ]

      const value = service.getGroupValue(items, 123, 'priceCNY')
      expect(value).toBe(100)
    })

    it('should return 0 if no value found', () => {
      const items: IPurchaseItem[] = [
        {
          nmID: 123,
          vendorCode: 'ABC',
          techSize: 'M',
          priceCNY: 0,
          quantity: 1,
          logisticsCNY: 0,
          fulfillmentRUB: 0,
          packagingRUB: 0,
          kizRUB: 0,
        },
      ]

      const value = service.getGroupValue(items, 123, 'priceCNY')
      expect(value).toBe(0)
    })
  })

  describe('applyValueToGroup', () => {
    it('should apply value to all items in group', () => {
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
            priceCNY: 0,
            quantity: 1,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 123,
            vendorCode: 'ABC',
            techSize: 'L',
            priceCNY: 0,
            quantity: 1,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
          {
            nmID: 456,
            vendorCode: 'DEF',
            techSize: 'M',
            priceCNY: 50,
            quantity: 1,
            logisticsCNY: 0,
            fulfillmentRUB: 0,
            packagingRUB: 0,
            kizRUB: 0,
          },
        ],
      }

      const result = service.applyValueToGroup(purchase, 123, 'priceCNY', 100)

      expect(result.items[0].priceCNY).toBe(100)
      expect(result.items[1].priceCNY).toBe(100)
      expect(result.items[2].priceCNY).toBe(50) // Не изменён, другой nmID
    })
  })
})
