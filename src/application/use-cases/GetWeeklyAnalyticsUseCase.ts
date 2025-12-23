import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'

export interface WeeklyAnalytics {
  weekId: string // Format: "2024-W45"
  weekNumber: number // 45
  year: number // 2024
  period: string // "02.12 - 08.12"
  totalSales: number // Сумма retail_amount из sales
  salesBeforeSpp: number // Сумма retail_price * quantity из sales
  totalReturns: number // Сумма retail_amount из returns
  netPay: number // (сумма ppvz_for_pay из sales) - (сумма ppvz_for_pay из returns)
  logistics: number // Общая сумма delivery_rub
}

export interface WeeklyAnalyticsResult {
  weeks: WeeklyAnalytics[]
  totals: {
    totalSales: number
    salesBeforeSpp: number
    totalReturns: number
    netPay: number
    logistics: number
  }
}

export class GetWeeklyAnalyticsUseCase {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository
  ) {}

  /**
   * Получает аналитику по неделям из базы данных
   */
  async execute(): Promise<WeeklyAnalyticsResult> {
    // Получаем все продажи и возвраты
    const sales = await this.saleRepository.getAll()
    const returns = await this.returnRepository.getAll()

    console.log('[GetWeeklyAnalyticsUseCase] Всего продаж:', sales.length)
    if (sales.length > 0) {
      const firstSale = sales[0]
      console.log('[GetWeeklyAnalyticsUseCase] Первая продажа:', {
        rr_dt: firstSale.rr_dt,
        retail_price: firstSale.retail_price,
        quantity: firstSale.quantity,
        retail_amount: firstSale.retail_amount,
        calculated: (firstSale.retail_price || 0) * (firstSale.quantity || 0)
      })
      
      // Проверяем несколько первых продаж
      const sampleSales = sales.slice(0, Math.min(5, sales.length))
      console.log('[GetWeeklyAnalyticsUseCase] Примеры продаж:', sampleSales.map(s => ({
        retail_price: s.retail_price,
        quantity: s.quantity,
        calculated: (s.retail_price || 0) * (s.quantity || 0)
      })))
    }

    // Группируем по неделям
    const weeksMap = new Map<string, WeeklyAnalytics>()

    // Обрабатываем продажи
    let totalSalesBeforeSpp = 0
    for (const sale of sales) {
      const weekId = this.getWeekIdFromDate(sale.rr_dt)
      const weekData = this.getOrCreateWeek(weeksMap, weekId, sale.rr_dt)
      
      // Продажа до СПП = retail_price * quantity
      const saleBeforeSpp = (sale.retail_price || 0) * (sale.quantity || 0)
      totalSalesBeforeSpp += saleBeforeSpp
      
      weekData.totalSales += sale.retail_amount || 0
      weekData.salesBeforeSpp += saleBeforeSpp
      weekData.netPay += sale.ppvz_for_pay || 0
      weekData.logistics += sale.delivery_rub || 0
    }
    
    console.log('[GetWeeklyAnalyticsUseCase] Общая сумма salesBeforeSpp:', totalSalesBeforeSpp)

    // Обрабатываем возвраты
    for (const ret of returns) {
      const weekId = this.getWeekIdFromDate(ret.rr_dt)
      const weekData = this.getOrCreateWeek(weeksMap, weekId, ret.rr_dt)
      
      weekData.totalReturns += ret.retail_amount || 0
      weekData.netPay -= ret.ppvz_for_pay || 0 // Вычитаем из netPay
      weekData.logistics += ret.delivery_rub || 0
    }

    // Преобразуем Map в массив и сортируем по weekId
    const weeks = Array.from(weeksMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.weekNumber - b.weekNumber
    })

    // Вычисляем итоги
    const totals = {
      totalSales: weeks.reduce((sum, w) => sum + w.totalSales, 0),
      salesBeforeSpp: weeks.reduce((sum, w) => sum + w.salesBeforeSpp, 0),
      totalReturns: weeks.reduce((sum, w) => sum + w.totalReturns, 0),
      netPay: weeks.reduce((sum, w) => sum + w.netPay, 0),
      logistics: weeks.reduce((sum, w) => sum + w.logistics, 0),
    }

    console.log('[GetWeeklyAnalyticsUseCase] Итоги:', totals)
    console.log('[GetWeeklyAnalyticsUseCase] Примеры недель:', weeks.slice(0, 3).map(w => ({
      weekId: w.weekId,
      salesBeforeSpp: w.salesBeforeSpp,
      totalSales: w.totalSales
    })))

    return { weeks, totals }
  }

  /**
   * Получает или создает запись недели в Map
   */
  private getOrCreateWeek(
    weeksMap: Map<string, WeeklyAnalytics>,
    weekId: string,
    dateStr: string
  ): WeeklyAnalytics {
    if (!weeksMap.has(weekId)) {
      const date = new Date(dateStr)
      const { year, weekNumber } = this.parseWeekId(weekId)
      const period = this.getWeekPeriod(date)
      
      weeksMap.set(weekId, {
        weekId,
        weekNumber,
        year,
        period,
        totalSales: 0,
        salesBeforeSpp: 0,
        totalReturns: 0,
        netPay: 0,
        logistics: 0,
      })
    }
    return weeksMap.get(weekId)!
  }

  /**
   * Извлекает weekId из даты в формате "YYYY-WNN"
   */
  private getWeekIdFromDate(dateStr: string): string {
    const date = new Date(dateStr)
    return this.getWeekId(date)
  }

  /**
   * Генерирует идентификатор недели в формате "YYYY-WNN"
   * Использует ISO недели (неделя начинается с понедельника)
   */
  private getWeekId(date: Date): string {
    const year = date.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    
    // Находим первый понедельник года
    const firstMonday = new Date(startOfYear)
    const dayOfWeek = startOfYear.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    firstMonday.setDate(firstMonday.getDate() + daysToMonday)
    
    // Если 1 января - понедельник, то первая неделя начинается с него
    if (dayOfWeek === 1) {
      firstMonday.setTime(startOfYear.getTime())
    }
    
    // Если дата раньше первого понедельника, берем предыдущий год
    if (date < firstMonday) {
      const prevYear = year - 1
      const prevYearStart = new Date(prevYear, 11, 31)
      return this.getWeekId(prevYearStart)
    }
    
    const days = Math.floor((date.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.floor(days / 7) + 1
    
    return `${year}-W${String(weekNumber).padStart(2, '0')}`
  }

  /**
   * Парсит weekId в year и weekNumber
   */
  private parseWeekId(weekId: string): { year: number; weekNumber: number } {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/)
    if (!match) {
      throw new Error(`Invalid weekId format: ${weekId}`)
    }
    return {
      year: parseInt(match[1], 10),
      weekNumber: parseInt(match[2], 10),
    }
  }

  /**
   * Форматирует период недели для отображения
   */
  private getWeekPeriod(date: Date): string {
    // Находим начало недели (понедельник)
    const weekStart = new Date(date)
    const dayOfWeek = weekStart.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    weekStart.setDate(weekStart.getDate() + diff)
    
    // Находим конец недели (воскресенье)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    const formatDate = (d: Date): string => {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${day}.${month}`
    }
    
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
  }
}
