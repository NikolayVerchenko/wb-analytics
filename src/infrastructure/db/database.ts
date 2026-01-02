import Dexie, { Table } from 'dexie'

/**
 * База данных WbAnalyticsDB
 * Версия 1: Базовая структура
 */
export class WbDatabase extends Dexie {
  // Основная таблица продаж (с короткими ключами)
  sales!: Table<any, number>
  
  // Заказы на закупку (для расчета себестоимости)
  purchaseOrders!: Table<any, number>
  
  // Настройки приложения (ключ-значение)
  settings!: Table<any, string>
  
  // Реестр синхронизации (контроль дат загрузки)
  syncRegistry!: Table<any, string>

  constructor() {
    super('WbAnalyticsDB')
    
    // Версия 1: Базовая структура (схему определим в следующем шаге)
    this.version(1).stores({
      sales: '',
      purchaseOrders: '',
      settings: '',
      syncRegistry: '',
    })
  }
}

export const db = new WbDatabase()
