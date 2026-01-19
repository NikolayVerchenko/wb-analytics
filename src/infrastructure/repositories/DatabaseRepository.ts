import type { IDatabaseRepository } from '../../core/domain/repositories/IDatabaseRepository'
import type { ISale, IReturn, ILogistics, IPenalty, IAdvCost, IStorageCost, IAcceptanceCost, IProductOrder, IProductCard, IUnitCost, IWarehouseRemain, ISupply } from '../../types/db'
import type { WbDatabase } from '../../db/db'

export class DatabaseRepository implements IDatabaseRepository {
  constructor(private db: WbDatabase) {}

  async getSales(dateFrom: string, dateTo: string): Promise<ISale[]> {
    return this.db.sales.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getAllSales(): Promise<ISale[]> {
    return this.db.sales.toArray()
  }

  async getReturns(dateFrom: string, dateTo: string): Promise<IReturn[]> {
    return this.db.returns.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getLogistics(dateFrom: string, dateTo: string): Promise<ILogistics[]> {
    return this.db.logistics.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getPenalties(dateFrom: string, dateTo: string): Promise<IPenalty[]> {
    return this.db.penalties.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getAdvCosts(dateFrom: string, dateTo: string): Promise<IAdvCost[]> {
    const rows = await this.db.adv_costs.where('dt').between(dateFrom, dateTo, true, true).toArray()
    if (rows.length > 0) {
      console.log(`[DatabaseRepository] getAdvCosts: indexed rows=${rows.length}, period=${dateFrom} - ${dateTo}`)
      return rows
    }

    const normalizeDate = (value: unknown): string => {
      if (!value) return ''
      if (value instanceof Date) {
        return value.toISOString().split('T')[0]
      }
      if (typeof value === 'string') {
        return value.split('T')[0].split(' ')[0]
      }
      return String(value).split('T')[0].split(' ')[0]
    }

    const normalizedFrom = normalizeDate(dateFrom)
    const normalizedTo = normalizeDate(dateTo)
    const all = await this.db.adv_costs.toArray()
    const filtered = all.filter((item) => {
      const dt = normalizeDate(item.dt)
      return dt >= normalizedFrom && dt <= normalizedTo
    })
    console.log(`[DatabaseRepository] getAdvCosts: fallback rows=${filtered.length}, total=${all.length}, period=${normalizedFrom} - ${normalizedTo}`)
    if (filtered.length === 0 && all.length > 0) {
      const sampleDates = [...new Set(all.slice(0, 10).map((item) => normalizeDate(item.dt)))].join(', ')
      console.log(`[DatabaseRepository] getAdvCosts: fallback sample dt=${sampleDates}`)
    }
    return filtered
  }

  async getStorageCosts(dateFrom: string, dateTo: string): Promise<IStorageCost[]> {
    return this.db.storage_costs.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getAcceptanceCosts(dateFrom: string, dateTo: string): Promise<IAcceptanceCost[]> {
    return this.db.acceptance_costs.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getProductOrders(dateFrom: string, dateTo: string): Promise<IProductOrder[]> {
    return this.db.product_orders.where('dt').between(dateFrom, dateTo, true, true).toArray()
  }

  async getProductCards(): Promise<IProductCard[]> {
    return this.db.product_cards.toArray()
  }

  async getUnitCosts(): Promise<IUnitCost[]> {
    return this.db.unit_costs.toArray()
  }

  async getWarehouseRemains(): Promise<IWarehouseRemain[]> {
    return this.db.warehouse_remains.toArray()
  }

  async getSupplies(): Promise<ISupply[]> {
    return this.db.supplies.toArray()
  }

  async getSupplyById(id: number): Promise<ISupply | undefined> {
    return this.db.supplies.get(id)
  }

  async saveSupply(supply: ISupply): Promise<void> {
    await this.db.supplies.put(supply)
  }

  async updateSupplyItemCost(supplyID: number, nmID: number, techSize: string, cost: number | undefined): Promise<void> {
    console.log(`[DatabaseRepository] updateSupplyItemCost: начало, supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}, cost=${cost}`)
    
    const supply = await this.db.supplies.get(supplyID)
    if (!supply) {
      throw new Error(`Поставка с ID ${supplyID} не найдена`)
    }

    console.log(`[DatabaseRepository] updateSupplyItemCost: найдена поставка, items=${supply.items.length}`)

    // Обновляем себестоимость у соответствующего товара
    let itemFound = false
    const updatedItems = supply.items.map((item) => {
      if (item.nmID === nmID && item.techSize === techSize) {
        itemFound = true
        const updatedItem = {
          ...item,
          cost,
        }
        console.log(`[DatabaseRepository] updateSupplyItemCost: обновлен item, старый cost=${item.cost}, новый cost=${cost}`)
        return updatedItem
      }
      return item
    })

    if (!itemFound) {
      console.warn(`[DatabaseRepository] updateSupplyItemCost: товар не найден в поставке (nmID=${nmID}, techSize=${techSize})`)
    }

    // Сохраняем обновленную поставку
    const updatedSupply = {
      ...supply,
      items: updatedItems,
    }
    
    console.log(`[DatabaseRepository] updateSupplyItemCost: сохранение поставки в IndexedDB`)
    await this.db.supplies.put(updatedSupply)
    
    // Проверяем, что данные сохранились
    const savedSupply = await this.db.supplies.get(supplyID)
    if (savedSupply) {
      const savedItem = savedSupply.items.find(item => item.nmID === nmID && item.techSize === techSize)
      console.log(`[DatabaseRepository] updateSupplyItemCost: проверка сохранения, cost в БД=${savedItem?.cost}`)
    }
  }

  async getSetting(key: string): Promise<{ key: string; value: string } | undefined> {
    return this.db.settings.get(key)
  }

  async saveSetting(key: string, value: string): Promise<void> {
    await this.db.settings.put({ key, value })
  }
}
