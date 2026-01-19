import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DatabaseRepository } from '../../src/infrastructure/repositories/DatabaseRepository'
import type { WbDatabase } from '../../src/db/db'

// Mock Dexie database
const mockDb = {
  sales: {
    where: vi.fn().mockReturnThis(),
    between: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
  },
  returns: {
    where: vi.fn().mockReturnThis(),
    between: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
  },
  settings: {
    get: vi.fn(),
    put: vi.fn(),
  },
} as any

describe('DatabaseRepository', () => {
  let repository: DatabaseRepository

  beforeEach(() => {
    repository = new DatabaseRepository(mockDb)
  })

  describe('getSales', () => {
    it('should get sales between dates', async () => {
      // Arrange
      const mockSales = [{ id: 1, dt: '2024-01-01', nmID: 123 }]
      mockDb.sales.toArray.mockResolvedValue(mockSales)

      // Act
      const result = await repository.getSales('2024-01-01', '2024-01-31')

      // Assert
      expect(mockDb.sales.where).toHaveBeenCalledWith('dt')
      expect(mockDb.sales.between).toHaveBeenCalledWith('2024-01-01', '2024-01-31', true, true)
      expect(mockDb.sales.toArray).toHaveBeenCalled()
      expect(result).toEqual(mockSales)
    })
  })

  describe('getSetting', () => {
    it('should get setting by key', async () => {
      // Arrange
      const mockSetting = { key: 'global_tax', value: '6' }
      mockDb.settings.get.mockResolvedValue(mockSetting)

      // Act
      const result = await repository.getSetting('global_tax')

      // Assert
      expect(mockDb.settings.get).toHaveBeenCalledWith('global_tax')
      expect(result).toEqual(mockSetting)
    })

    it('should return undefined when setting not found', async () => {
      // Arrange
      mockDb.settings.get.mockResolvedValue(undefined)

      // Act
      const result = await repository.getSetting('nonexistent')

      // Assert
      expect(mockDb.settings.get).toHaveBeenCalledWith('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('saveSetting', () => {
    it('should save setting', async () => {
      // Arrange
      const key = 'global_tax'
      const value = '8'

      // Act
      await repository.saveSetting(key, value)

      // Assert
      expect(mockDb.settings.put).toHaveBeenCalledWith({ key, value })
    })
  })
})
