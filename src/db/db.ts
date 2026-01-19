import Dexie, { Table } from 'dexie'
import type { ISale, IReturn, ILogistics, IPenalty, IDeduction, IAdvCost, IAcceptanceCost, IStorageCost, IProductOrder, IProductCard, IWarehouseRemain, IUnitCost, ISupply, IPurchase, ILoadedPeriod } from '../types/db'
import type { TableColumnsPreset } from '../types/tablePresets'

/**
 * База данных WbAnalyticsDB
 * Версия 10: добавлена таблица поставок (supplies)
 * Версия 11: добавлен индекс gi_id в таблицу sales
 * Версия 12: добавлена таблица закупок из Китая (purchases)
 * Версия 13: добавлена таблица пресетов колонок (table_presets)
 * Версия 14: добавлена таблица загруженных периодов (loaded_periods)
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
  
  // Поставки
  supplies!: Table<ISupply, number>
  
  // Закупки из Китая
  purchases!: Table<IPurchase, number>
  
  // Системные таблицы
  settings!: Table<{ key: string; value: string }, string>
  syncRegistry!: Table<{ key: string; value: any; updatedAt: number }, string>
  
  // Пресеты колонок таблиц
  table_presets!: Table<TableColumnsPreset, string>
  
  // Загруженные периоды данных
  loaded_periods!: Table<ILoadedPeriod, number>

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
    
    // Версия 10: добавлена таблица поставок
    this.version(10).stores({
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
    })
    
    // Версия 11: добавлен индекс gi_id в таблицу sales
    this.version(11).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj, gi_id',
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
    })
    
    // Версия 12: добавлена таблица закупок из Китая
    this.version(12).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj, gi_id',
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Закупки из Китая
      purchases: '++id, date, orderNumber, status',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
    })
    
    // Версия 13: добавлена таблица пресетов колонок
    this.version(13).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj, gi_id',
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Закупки из Китая
      purchases: '++id, date, orderNumber, status',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
      // Пресеты колонок таблиц
      table_presets: 'id, tableId, [tableId+name]',
    })
    
    // Версия 14: добавлена таблица загруженных периодов
    this.version(14).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj, gi_id',
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Закупки из Китая
      purchases: '++id, date, orderNumber, status',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
      // Пресеты колонок таблиц
      table_presets: 'id, tableId, [tableId+name]',
      // Загруженные периоды данных
      loaded_periods: '++id, ds, pt, fr, to, [ds+fr], [ds+to]',
    })
    
    // Версия 15: добавлен составной индекс [ds+fr+to+pt] для оптимизации upsert
    this.version(15).stores({
      // Финансовые таблицы с pk как Primary Key
      sales: 'pk, dt, ni, sa, bc, sj, gi_id',
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
      // Поставки
      supplies: 'supplyID, factDate, createDate',
      // Закупки из Китая
      purchases: '++id, date, orderNumber, status',
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
      // Пресеты колонок таблиц
      table_presets: 'id, tableId, [tableId+name]',
      // Загруженные периоды данных
      // Составной индекс [ds+fr+to+pt] обеспечивает уникальность периода и оптимизацию upsert
      loaded_periods: '++id, ds, pt, fr, to, [ds+fr], [ds+to], [ds+fr+to+pt]',
    })
  }
}

export const db = new WbDatabase()

