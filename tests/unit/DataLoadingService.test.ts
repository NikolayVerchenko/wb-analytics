import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DataLoadingService } from '../../src/application/services/DataLoadingService'
import type { IDatabaseRepository } from '../../src/core/domain/repositories/IDatabaseRepository'

// Mock the database types
const mockSales = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockReturns = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockLogistics = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockPenalties = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockAdvCosts = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockStorageCosts = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockAcceptanceCosts = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockProductOrders = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
const mockProductCards = [{ ni: 123, title: 'Test Product' }]
const mockUnitCosts = [{ nmID: 123, cost: 100 }]

describe('DataLoadingService', () => {
  let mockRepository: jest.Mocked<IDatabaseRepository>
  let service: DataLoadingService

  beforeEach(() => {
    mockRepository = {
      getSales: vi.fn(),
      getAllSales: vi.fn(),
      getReturns: vi.fn(),
      getLogistics: vi.fn(),
      getPenalties: vi.fn(),
      getAdvCosts: vi.fn(),
      getStorageCosts: vi.fn(),
      getAcceptanceCosts: vi.fn(),
      getProductOrders: vi.fn(),
      getProductCards: vi.fn(),
      getUnitCosts: vi.fn(),
      getWarehouseRemains: vi.fn(),
      getSupplies: vi.fn(),
      getSupplyById: vi.fn(),
      saveSupply: vi.fn(),
      updateSupplyItemCost: vi.fn(),
      getSetting: vi.fn(),
      saveSetting: vi.fn(),
    } as any

    service = new DataLoadingService(mockRepository)
  })

  describe('loadPriorityData', () => {
    it('should load priority data from repository', async () => {
      // Arrange
      mockRepository.getSales.mockResolvedValue(mockSales)
      mockRepository.getReturns.mockResolvedValue(mockReturns)
      mockRepository.getLogistics.mockResolvedValue(mockLogistics)
      mockRepository.getPenalties.mockResolvedValue(mockPenalties)
      mockRepository.getAdvCosts.mockResolvedValue(mockAdvCosts)
      mockRepository.getStorageCosts.mockResolvedValue(mockStorageCosts)
      mockRepository.getAcceptanceCosts.mockResolvedValue(mockAcceptanceCosts)
      mockRepository.getProductOrders.mockResolvedValue(mockProductOrders)
      mockRepository.getProductCards.mockResolvedValue(mockProductCards)
      mockRepository.getUnitCosts.mockResolvedValue(mockUnitCosts)

      // Act
      const result = await service.loadPriorityData('2024-01-01', '2024-01-31')

      // Assert
      expect(mockRepository.getSales).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getReturns).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getLogistics).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getPenalties).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getAdvCosts).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getStorageCosts).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getAcceptanceCosts).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getProductOrders).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
      expect(mockRepository.getProductCards).toHaveBeenCalled()
      expect(mockRepository.getUnitCosts).toHaveBeenCalled()

      expect(result).toEqual({
        sales: mockSales,
        returns: mockReturns,
        logistics: mockLogistics,
        penalties: mockPenalties,
        deductions: [],
        advCosts: mockAdvCosts,
        storageCosts: mockStorageCosts,
        acceptanceCosts: mockAcceptanceCosts,
        productOrders: mockProductOrders,
        productCards: mockProductCards,
        unitCosts: mockUnitCosts,
      })
    })
  })

  describe('getGlobalTaxRate', () => {
    it('should return default tax rate when no setting exists', async () => {
      // Arrange
      mockRepository.getSetting.mockResolvedValue(undefined)

      // Act
      const result = await service.getGlobalTaxRate()

      // Assert
      expect(mockRepository.getSetting).toHaveBeenCalledWith('global_tax')
      expect(result).toBe(6)
    })

    it('should return tax rate from settings', async () => {
      // Arrange
      mockRepository.getSetting.mockResolvedValue({ key: 'global_tax', value: '10' })

      // Act
      const result = await service.getGlobalTaxRate()

      // Assert
      expect(mockRepository.getSetting).toHaveBeenCalledWith('global_tax')
      expect(result).toBe(10)
    })
  })

  describe('saveGlobalTaxRate', () => {
    it('should save tax rate to settings', async () => {
      // Arrange
      const taxRate = 8

      // Act
      await service.saveGlobalTaxRate(taxRate)

      // Assert
      expect(mockRepository.saveSetting).toHaveBeenCalledWith('global_tax', '8')
    })
  })
})
