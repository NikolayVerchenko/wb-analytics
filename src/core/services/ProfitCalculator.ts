import { db } from '../../db/db'
import type { ISale, ILogistics, IAdvCost, IStorageCost, IAcceptanceCost, IUnitCost } from '../../types/db'

/**
 * Интерфейс результата расчета прибыли для одного товара
 */
export interface IProductProfit {
  ni: number // Артикул WB
  revenue: number // Выручка (сумма продаж)
  commission: number // Комиссия WB (уже включена в продажи)
  logistics: number // Логистика
  advertising: number // Реклама
  storage: number // Хранение
  acceptance: number // Приемка
  unitCost: number // Себестоимость единицы товара
  quantity: number // Количество проданных единиц
  totalCost: number // Общая себестоимость (quantity * unitCost)
  netProfit: number // Чистая прибыль
}

/**
 * Параметры для расчета прибыли
 */
export interface IProfitCalculationParams {
  dateFrom: string // Начальная дата (YYYY-MM-DD)
  dateTo: string // Конечная дата (YYYY-MM-DD)
  nmIds?: number[] // Фильтр по артикулам (опционально)
}

/**
 * Сервис для расчета прибыли товаров
 */
export class ProfitCalculator {
  /**
   * Рассчитывает прибыль для товаров за период
   * Формула: Чистая прибыль = (Выручка - Комиссия - Логистика - Реклама - Хранение - Приемка) - (Количество_продаж * Себестоимость)
   * 
   * @param params Параметры расчета
   * @returns Массив результатов расчета прибыли для каждого товара
   */
  async calculateProfit(params: IProfitCalculationParams): Promise<IProductProfit[]> {
    const { dateFrom, dateTo, nmIds } = params

    // 1. Загружаем продажи (выручка)
    const sales = await this.getSales(dateFrom, dateTo, nmIds)
    
    // 2. Загружаем логистику
    const logistics = await this.getLogistics(dateFrom, dateTo, nmIds)
    
    // 3. Загружаем рекламные расходы
    const advCosts = await this.getAdvCosts(dateFrom, dateTo, nmIds)
    
    // 4. Загружаем стоимость хранения
    const storageCosts = await this.getStorageCosts(dateFrom, dateTo, nmIds)
    
    // 5. Загружаем стоимость приемки
    const acceptanceCosts = await this.getAcceptanceCosts(dateFrom, dateTo, nmIds)
    
    // 6. Загружаем себестоимость
    const unitCosts = await this.getUnitCosts(nmIds)

    // 7. Группируем данные по артикулу (ni)
    const profitMap = new Map<number, IProductProfit>()

    // Инициализируем все артикулы из продаж
    for (const sale of sales) {
      if (!profitMap.has(sale.ni)) {
        profitMap.set(sale.ni, {
          ni: sale.ni,
          revenue: 0,
          commission: 0,
          logistics: 0,
          advertising: 0,
          storage: 0,
          acceptance: 0,
          unitCost: 0,
          quantity: 0,
          totalCost: 0,
          netProfit: 0,
        })
      }
    }

    // Суммируем продажи (выручка)
    for (const sale of sales) {
      const profit = profitMap.get(sale.ni)!
      profit.revenue += sale.pa || 0 // pa - сумма продаж (retail_amount)
      profit.quantity += sale.qt || 0 // qt - количество (quantity)
      // Комиссия WB: pa (retail_amount) - pz (ppvz_for_pay) = комиссия
      // Выручка (pa) - это сумма продаж до комиссии
    }

    // Суммируем логистику
    for (const log of logistics) {
      const profit = profitMap.get(log.ni)
      if (profit) {
        // logistics.dr - сумма логистики (delivery_rub)
        profit.logistics += log.dr || 0
      }
    }

    // Суммируем рекламу (группируем по артикулу и дате)
    for (const adv of advCosts) {
      const profit = profitMap.get(adv.ni)
      if (profit) {
        profit.advertising += adv.costs || 0
      }
    }

    // Суммируем хранение (группируем по артикулу и дате)
    for (const storage of storageCosts) {
      const profit = profitMap.get(storage.ni)
      if (profit) {
        profit.storage += storage.sc || 0
      }
    }

    // Суммируем приемку (группируем по артикулу и дате)
    for (const acceptance of acceptanceCosts) {
      const profit = profitMap.get(acceptance.ni)
      if (profit) {
        profit.acceptance += acceptance.costs || 0
      }
    }

    // Добавляем себестоимость и рассчитываем итоговую прибыль
    for (const [ni, profit] of profitMap.entries()) {
      const unitCost = unitCosts.get(ni) || 0
      profit.unitCost = unitCost
      profit.totalCost = profit.quantity * unitCost
      
      // Формула: Чистая прибыль = (Выручка - Комиссия - Логистика - Реклама - Хранение - Приемка) - (Количество * Себестоимость)
      profit.netProfit = profit.revenue - profit.logistics - profit.advertising - profit.storage - profit.acceptance - profit.totalCost
    }

    return Array.from(profitMap.values())
  }

  /**
   * Загружает продажи за период
   */
  private async getSales(dateFrom: string, dateTo: string, nmIds?: number[]): Promise<ISale[]> {
    let query = db.sales
      .where('dt')
      .between(dateFrom, dateTo, true, true)
    
    if (nmIds && nmIds.length > 0) {
      query = query.filter(sale => nmIds.includes(sale.ni))
    }
    
    return query.toArray()
  }

  /**
   * Загружает логистику за период
   */
  private async getLogistics(dateFrom: string, dateTo: string, nmIds?: number[]): Promise<ILogistics[]> {
    let query = db.logistics
      .where('dt')
      .between(dateFrom, dateTo, true, true)
    
    if (nmIds && nmIds.length > 0) {
      query = query.filter(log => nmIds.includes(log.ni))
    }
    
    return query.toArray()
  }

  /**
   * Загружает рекламные расходы за период
   */
  private async getAdvCosts(dateFrom: string, dateTo: string, nmIds?: number[]): Promise<IAdvCost[]> {
    let query = db.adv_costs
      .where('dt')
      .between(dateFrom, dateTo, true, true)
    
    if (nmIds && nmIds.length > 0) {
      query = query.filter(adv => nmIds.includes(adv.ni))
    }
    
    return query.toArray()
  }

  /**
   * Загружает стоимость хранения за период
   */
  private async getStorageCosts(dateFrom: string, dateTo: string, nmIds?: number[]): Promise<IStorageCost[]> {
    let query = db.storage_costs
      .where('dt')
      .between(dateFrom, dateTo, true, true)
    
    if (nmIds && nmIds.length > 0) {
      query = query.filter(storage => nmIds.includes(storage.ni))
    }
    
    return query.toArray()
  }

  /**
   * Загружает стоимость приемки за период
   */
  private async getAcceptanceCosts(dateFrom: string, dateTo: string, nmIds?: number[]): Promise<IAcceptanceCost[]> {
    let query = db.acceptance_costs
      .where('dt')
      .between(dateFrom, dateTo, true, true)
    
    if (nmIds && nmIds.length > 0) {
      query = query.filter(acceptance => nmIds.includes(acceptance.ni))
    }
    
    return query.toArray()
  }

  /**
   * Загружает себестоимость товаров
   */
  private async getUnitCosts(nmIds?: number[]): Promise<Map<number, number>> {
    let query = db.unit_costs.toCollection()
    
    if (nmIds && nmIds.length > 0) {
      const unitCosts = await db.unit_costs
        .where('ni')
        .anyOf(nmIds)
        .toArray()
      return new Map(unitCosts.map(c => [c.ni, c.cost]))
    }
    
    const unitCosts = await query.toArray()
    return new Map(unitCosts.map(c => [c.ni, c.cost]))
  }
}

