import Dexie, { Table } from 'dexie'
import type { ISale, IReturn, ILogistics, IPenalty, IDeduction, IAdvCost, IAcceptanceCost, IStorageCost, IProductOrder, IProductCard, IWarehouseRemain, IUnitCost } from '../types/db'

/**
 * База данных WbAnalyticsDB
 * Версия 9: 5 финансовых таблиц + рекламные расходы + стоимость приемки + стоимость хранения + статистика заказов + карточки товаров + остатки на складах + себестоимость + 2 системные таблицы
 */
export class WbDatabase extends Dexie {
  // Финансовые таблицы
  sales!: Table<ISale, string>
  returns!: Table<IReturn, string>
  logistics!: Table<ILogistics, string>
  penalties!: Table<IPenalty, string>
  deductions!: Table<IDeduction, string>
  
  // Рекламные расходы
  adv_costs!: Table<IAdvCost, string>
  
  // Стоимость приемки
  acceptance_costs!: Table<IAcceptanceCost, string>
  
  // Стоимость хранения
  storage_costs!: Table<IStorageCost, string>
  
  // Статистика заказов (Воронка продаж v3)
  product_orders!: Table<IProductOrder, string>
  
  // Справочник карточек товаров
  product_cards!: Table<IProductCard, string>
  
  // Остатки на складах
  warehouse_remains!: Table<IWarehouseRemain, string>
  
  // Себестоимость товаров
  unit_costs!: Table<IUnitCost, number>
  
  // Системные таблицы
  settings!: Table<{ key: string; value: string }, string>
  syncRegistry!: Table<{ key: string; value: any; updatedAt: number }, string>

  constructor() {
    super('WbAnalyticsDB')
    
    // Версия 9: добавлена таблица себестоимости
    this.version(9).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj',
      returns: 'pk, dt, ni, sa, bc, sj',
      logistics: 'pk, dt, ni, sa, bc, sj',
      penalties: 'pk, dt, ni, sa, bc, sj',
      deductions: 'pk, dt, ni, sa, bc, sj',
      // Рекламные расходы
      adv_costs: 'pk, dt, ni',
      // Стоимость приемки
      acceptance_costs: 'pk, dt, ni',
      // Стоимость хранения
      storage_costs: 'pk, dt, ni, sz',
      // Статистика заказов (Воронка продаж v3)
      product_orders: 'pk, dt, ni',
      // Справочник карточек товаров
      product_cards: 'pk, ni, sz',
      // Остатки на складах
      warehouse_remains: 'pk, ni, sz',
      // Себестоимость товаров
      unit_costs: 'ni',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
    })
  }
}

export const db = new WbDatabase()

