import Dexie, { Table } from 'dexie'
import type { ISale, IReturn, ILogistics, IPenalty, IDeduction, IAdvCost, IAcceptanceCost } from '../types/db'

/**
 * База данных WbAnalyticsDB
 * Версия 4: 5 финансовых таблиц + рекламные расходы + стоимость приемки + 2 системные таблицы
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
  
  // Системные таблицы
  settings!: Table<{ key: string; value: string }, string>
  syncRegistry!: Table<{ key: string; value: any; updatedAt: number }, string>

  constructor() {
    super('WbAnalyticsDB')
    
    // Версия 4: добавлена таблица стоимости приемки
    this.version(4).stores({
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
      // Системные таблицы
      settings: 'key',
      syncRegistry: 'key',
    })
  }
}

export const db = new WbDatabase()

