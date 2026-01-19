import { describe, it, expect, beforeEach } from 'vitest'
import { CostMatchingService } from '../../src/application/services/cost/CostMatchingService'
import type { ISale, ISupply } from '../../src/types/db'

describe('CostMatchingService', () => {
  let service: CostMatchingService

  const createSupply = (
    supplyID: number,
    items: Array<{ nmID: number; techSize: string; cost?: number }>,
    factDate?: string,
    createDate = '2024-01-01'
  ): ISupply => {
    return {
      supplyID,
      factDate: factDate || null,
      createDate,
      supplyDate: null,
      items: items.map((item) => ({
        nmID: item.nmID,
        techSize: item.techSize,
        quantity: 10,
        acceptedQuantity: 10,
        cost: item.cost,
      })),
    }
  }

  const createSale = (
    ni: number,
    sz: string,
    gi_id?: number,
    qt = 1,
    dt = '2024-01-15',
    pk?: string
  ): ISale => {
    return {
      pk: pk || `${ni}_${dt}_${sz}`,
      dt,
      ni,
      sz,
      qt,
      gi_id,
      pa: 1000,
      pz: 900,
    }
  }

  describe('STRICT mode', () => {
    describe('OK - успешное сопоставление', () => {
      it('должен найти себестоимость в поставке', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 'S', 1, 2)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('OK')
        expect(matches[0].source).toBe('SUPPLY_MATCH')
        expect(matches[0].costPerUnit).toBe(100)
        expect(matches[0].costTotal).toBe(200) // 100 * 2
        expect(matches[0].matchedSupplyId).toBe(1)
        expect(matches[0].matchedItemKey).toBe('100|S')
        expect(stats.matched).toBe(1)
        expect(stats.byReason.OK).toBe(1)
      })
    })

    describe('NO_GI_ID - нет gi_id', () => {
      it('должен вернуть NO_GI_ID если gi_id отсутствует', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 'S', undefined)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('NO_GI_ID')
        expect(matches[0].source).toBe('NONE')
        expect(matches[0].costPerUnit).toBe(0)
        expect(stats.matched).toBe(0)
        expect(stats.byReason.NO_GI_ID).toBe(1)
      })

      it('должен вернуть NO_GI_ID если gi_id null', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 'S', null as any)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('NO_GI_ID')
      })
    })

    describe('SUPPLY_NOT_FOUND - поставка не найдена', () => {
      it('должен вернуть SUPPLY_NOT_FOUND если gi_id не существует в supplies', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 'S', 999)] // supplyID 999 не существует

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('SUPPLY_NOT_FOUND')
        expect(matches[0].source).toBe('NONE')
        expect(matches[0].costPerUnit).toBe(0)
        expect(stats.matched).toBe(0)
        expect(stats.byReason.SUPPLY_NOT_FOUND).toBe(1)
      })
    })

    describe('ITEM_NOT_FOUND - товар не найден в поставке', () => {
      it('должен вернуть ITEM_NOT_FOUND если nmID не совпадает', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(200, 'S', 1)] // nmID 200 не существует в поставке

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('ITEM_NOT_FOUND')
        expect(matches[0].source).toBe('NONE')
        expect(matches[0].costPerUnit).toBe(0)
        expect(stats.matched).toBe(0)
        expect(stats.byReason.ITEM_NOT_FOUND).toBe(1)
      })

      it('должен вернуть ITEM_NOT_FOUND если size не совпадает', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 'M', 1)] // size M не существует в поставке

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('ITEM_NOT_FOUND')
      })
    })

    describe('COST_EMPTY - себестоимость не задана', () => {
      it('должен вернуть COST_EMPTY если item есть, но cost отсутствует', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: undefined }]),
        ]
        const sales = [createSale(100, 'S', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('COST_EMPTY')
        expect(matches[0].source).toBe('NONE')
        expect(matches[0].costPerUnit).toBe(0)
        expect(matches[0].matchedSupplyId).toBe(1)
        expect(matches[0].matchedItemKey).toBe('100|S')
        expect(stats.matched).toBe(0)
        expect(stats.byReason.COST_EMPTY).toBe(1)
      })

      it('должен вернуть COST_EMPTY если cost === null', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: null as any }]),
        ]
        const sales = [createSale(100, 'S', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('COST_EMPTY')
      })

      it('должен вернуть COST_EMPTY если cost === 0', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 0 }]),
        ]
        const sales = [createSale(100, 'S', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('COST_EMPTY')
      })
    })

    describe('SIZE_EMPTY - размер пустой', () => {
      it('должен вернуть SIZE_EMPTY если sz пустой', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, '', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('SIZE_EMPTY')
        expect(matches[0].source).toBe('NONE')
        expect(matches[0].costPerUnit).toBe(0)
        expect(stats.matched).toBe(0)
        expect(stats.byReason.SIZE_EMPTY).toBe(1)
      })

      it('должен вернуть SIZE_EMPTY если sz undefined', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [{ ...createSale(100, 'S', 1), sz: undefined }]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('SIZE_EMPTY')
      })

      it('должен вернуть SIZE_EMPTY если sz только пробелы', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, '   ', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('SIZE_EMPTY')
      })
    })

    describe('NORMALIZATION - нормализация размера', () => {
      it('должен находить товар с нормализованным размером (пробелы)', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, ' s ', 1)] // " s " должно нормализоваться в "S"

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(1)
        expect(matches[0].reason).toBe('OK')
        expect(matches[0].costPerUnit).toBe(100)
        expect(stats.matched).toBe(1)
      })

      it('должен находить товар с нормализованным размером (регистр)', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: 'S', cost: 100 }]),
        ]
        const sales = [createSale(100, 's', 1)] // "s" должно нормализоваться в "S"

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('OK')
        expect(matches[0].costPerUnit).toBe(100)
      })

      it('должен находить товар если techSize в поставке с пробелами', () => {
        const supplies = [
          createSupply(1, [{ nmID: 100, techSize: ' s ', cost: 100 }]),
        ]
        const sales = [createSale(100, 'S', 1)]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches[0].reason).toBe('OK')
        expect(matches[0].costPerUnit).toBe(100)
      })
    })

    describe('Multiple sales', () => {
      it('должен обрабатывать несколько продаж с разными результатами', () => {
        const supplies = [
          createSupply(1, [
            { nmID: 100, techSize: 'S', cost: 100 },
            { nmID: 200, techSize: 'M', cost: undefined },
          ]),
        ]
        const sales = [
          createSale(100, 'S', 1), // OK
          createSale(200, 'M', 1), // COST_EMPTY
          createSale(300, 'L', 1), // ITEM_NOT_FOUND
          createSale(100, 'S', undefined), // NO_GI_ID
          createSale(100, 'S', 999), // SUPPLY_NOT_FOUND
        ]

        service = CostMatchingService.fromSupplies(supplies)
        const { matches, stats } = service.matchSales(sales, { mode: 'STRICT' })

        expect(matches).toHaveLength(5)
        expect(matches[0].reason).toBe('OK')
        expect(matches[1].reason).toBe('COST_EMPTY')
        expect(matches[2].reason).toBe('ITEM_NOT_FOUND')
        expect(matches[3].reason).toBe('NO_GI_ID')
        expect(matches[4].reason).toBe('SUPPLY_NOT_FOUND')

        expect(stats.totalSales).toBe(5)
        expect(stats.matched).toBe(1)
        expect(stats.byReason.OK).toBe(1)
        expect(stats.byReason.COST_EMPTY).toBe(1)
        expect(stats.byReason.ITEM_NOT_FOUND).toBe(1)
        expect(stats.byReason.NO_GI_ID).toBe(1)
        expect(stats.byReason.SUPPLY_NOT_FOUND).toBe(1)
      })
    })
  })

  describe('STRICT_WITH_APPROX mode', () => {
    it('должен использовать APPROX если строгий режим не находит себестоимость', () => {
      const supplies = [
        createSupply(1, [{ nmID: 100, techSize: 'S', cost: undefined }]), // cost пустой
        createSupply(2, [{ nmID: 100, techSize: 'S', cost: 150 }]), // есть cost в другой поставке
      ]
      const sales = [createSale(100, 'S', 1)] // ищем в поставке 1, но cost пустой

      service = CostMatchingService.fromSupplies(supplies, { buildApprox: true })
      const { matches, stats } = service.matchSales(sales, {
        mode: 'STRICT_WITH_APPROX',
      })

      expect(matches).toHaveLength(1)
      expect(matches[0].reason).toBe('APPROX_FROM_OTHER_SUPPLY')
      expect(matches[0].source).toBe('APPROX')
      expect(matches[0].costPerUnit).toBe(150) // из поставки 2
      expect(matches[0].matchedSupplyId).toBe(2)
      expect(stats.matched).toBe(0) // matched только для OK
      expect(stats.byReason.APPROX_FROM_OTHER_SUPPLY).toBe(1)
    })

    it('должен использовать date heuristic для выбора поставки', () => {
      const supplies = [
        createSupply(1, [{ nmID: 100, techSize: 'S', cost: undefined }], '2024-01-01'),
        createSupply(2, [{ nmID: 100, techSize: 'S', cost: 100 }], '2024-01-10'),
        createSupply(3, [{ nmID: 100, techSize: 'S', cost: 150 }], '2024-01-20'),
      ]
      const sales = [createSale(100, 'S', 1, 1, '2024-01-15')] // дата между 2 и 3

      service = CostMatchingService.fromSupplies(supplies, { buildApprox: true })
      const { matches } = service.matchSales(sales, {
        mode: 'STRICT_WITH_APPROX',
        useDateHeuristic: true,
      })

      expect(matches[0].reason).toBe('APPROX_FROM_OTHER_SUPPLY')
      expect(matches[0].costPerUnit).toBe(100) // выбран supply 2 (date <= sale.dt и максимальный)
      expect(matches[0].matchedSupplyId).toBe(2)
    })
  })
})
