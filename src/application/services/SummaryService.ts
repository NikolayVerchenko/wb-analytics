import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'
import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'
import type { SyncRegistryRepository } from '@infrastructure/repositories/SyncRegistryRepository'
import type { DatePeriodService } from '@core/services/DatePeriodService'

export interface SummaryFilters {
  dateFrom?: string
  dateTo?: string
  categories?: string[] // subject_name
  searchQuery?: string // поиск по sa_name
  vendorCodes?: string[] // sa_name артикулы продавца
}

export interface SummaryRow {
  sa_name: string
  subject_name: string
  ts_name?: string // undefined для групповых строк (по артикулу)
  isExpanded: boolean
  isGroupRow: boolean // true для строк артикула, false для строк размера
  quantity: number
  salesAmount: number // retail_amount
  deliveryAmount: number // delivery_amount (количество доставок)
  returnAmount: number // return_amount (количество отказов из sales)
  actualReturns: number // quantity из таблицы returns (возвраты от клиентов)
  returnsAmount: number // retail_amount из таблицы returns
  realizationBeforeSppAmount: number // retail_price (sales) - retail_price (returns) = реализация до СПП в рублях
  realizationAfterSppAmount: number // retail_amount (sales) - retail_amount (returns) = реализация после СПП в рублях
  sppPercent: number // (сумма СПП / Реализация до СПП) * 100 = процент СПП
  buyoutPercent: number // ((quantity - actualReturns) / deliveryAmount) * 100 - процент выкупа по количеству
  logistics: number // delivery_rub
  penalty: number
  netPay: number // ppvz_for_pay
  wbCommissionAmount: number // realizationBeforeSppAmount - netPay = сумма комиссии ВБ
  wbCommissionPercent: number // (wbCommissionAmount / realizationBeforeSppAmount) * 100 = процент комиссии ВБ
  children?: SummaryRow[] // детализация по размерам
}

export class SummaryService {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository,
    private syncRegistry: SyncRegistryRepository,
    private datePeriodService: DatePeriodService
  ) {}

  /**
   * Получает индикатор типа данных (Daily vs Final) для периода
   */
  async getDataTypeIndicator(dateFrom?: string, dateTo?: string): Promise<{
    icon: string
    label: string
    tooltip: string
  } | null> {
    if (!dateFrom || !dateTo) return null

    try {
      const fromDate = new Date(dateFrom + 'T00:00:00Z')
      const toDate = new Date(dateTo + 'T23:59:59Z')
      
      const weekPeriods = this.datePeriodService.generateWeeklyPeriodsBetween(fromDate, toDate)
      const weeks = weekPeriods.map(w => w.weekId)
      
      let hasFinalData = false
      let hasMixedData = false
      
      for (const weekId of weeks) {
        const entry = await this.syncRegistry.getByPeriod(weekId, 'weekly')
        if (entry?.isFinal) {
          hasFinalData = true
        } else if (entry?.status === 'success') {
          hasMixedData = true
        }
      }
      
      if (hasFinalData) {
        return {
          icon: '💎',
          label: 'Final (подтверждено)',
          tooltip: 'Данные содержат официальные недельные отчеты. Это финальные финансовые данные, подтвержденные Wildberries'
        }
      } else if (hasMixedData) {
        return {
          icon: '☁️',
          label: 'Daily (предварительно)',
          tooltip: 'Данные содержат предварительные дневные отчеты. Они будут заменены на финальные недельные отчеты при их получении'
        }
      }
      return null
    } catch (error) {
      console.error('Ошибка при определении типа данных:', error)
      return null
    }
  }


  private logTotals<T extends ReportSale | ReportReturn>(label: string, items: T[]) {
    const totalSalesBeforeSpp = items.reduce((sum, item) => sum + ((item.retail_price || 0) * (item.quantity || 0)), 0)
    const totalSalesAmount = items.reduce((sum, item) => sum + (item.retail_amount || 0), 0)
    console.log(`[SummaryService][${label}] Total retail_price * quantity: ${totalSalesBeforeSpp.toFixed(2)}, Total retail_amount: ${totalSalesAmount.toFixed(2)}`)
  }

  /**
   * Получает и обрабатывает данные для сводной таблицы
   */
  async getSummaryData(filters: SummaryFilters = {}): Promise<SummaryRow[]> {
    const dateFrom = filters.dateFrom ? filters.dateFrom.split('T')[0] : '2024-01-01'
    const dateTo = filters.dateTo ? filters.dateTo.split('T')[0] : '2029-12-31'

    console.log(`[SummaryService][getSummaryData] Запрос данных для диапазона: ${dateFrom} - ${dateTo}`)

    // Получаем данные только за нужный период из репозиториев
    let sales = await this.saleRepository.getByDateRange(dateFrom, dateTo)
    let returns = await this.returnRepository.getByDateRange(dateFrom, dateTo)
    console.log(`[SummaryService][getSummaryData] Продажи после getByDateRange: ${sales.length} записей`)
    console.log(`[SummaryService][getSummaryData] Возвраты после getByDateRange: ${returns.length} записей`)
    this.logTotals('До приоритизации (Sales)', sales)
    this.logTotals('До приоритизации (Returns)', returns)

    // Приоритизация: выбираем final если есть, иначе temp
    sales = this.prioritizeFinalData(sales)
    returns = this.prioritizeFinalData(returns)
    console.log(`[SummaryService][getSummaryData] Продажи после prioritizeFinalData: ${sales.length} записей`)
    console.log(`[SummaryService][getSummaryData] Возвраты после prioritizeFinalData: ${returns.length} записей`)
    this.logTotals('После приоритизации (Sales)', sales)
    this.logTotals('После приоритизации (Returns)', returns)

    // Применяем фильтры
    sales = this.applyFilters(sales, filters)
    returns = this.applyFilters(returns, filters)
    console.log(`[SummaryService][getSummaryData] Продажи после applyFilters: ${sales.length} записей`)
    console.log(`[SummaryService][getSummaryData] Возвраты после applyFilters: ${returns.length} записей`)
    this.logTotals('После фильтрации (Sales)', sales)
    this.logTotals('После фильтрации (Returns)', returns)
    
    // Создаем Map для быстрого поиска возвратов по ключу (группируем по sa_name + ts_name)
    const returnsMap = new Map<string, {
      quantity: number
      retail_amount: number
      delivery_rub: number
      ppvz_for_pay: number
      penalty: number
    }>()
    
    for (const ret of returns) {
      const key = this.createKey(ret.sa_name, ret.ts_name)
      const existing = returnsMap.get(key)
      
      if (existing) {
        existing.quantity += ret.quantity || 0
        existing.retail_amount += ret.retail_amount || 0
        existing.delivery_rub += ret.delivery_rub || 0
        existing.ppvz_for_pay += ret.ppvz_for_pay || 0
        existing.penalty += ret.penalty || 0
      } else {
        returnsMap.set(key, {
          quantity: ret.quantity || 0,
          retail_amount: ret.retail_amount || 0,
          delivery_rub: ret.delivery_rub || 0,
          ppvz_for_pay: ret.ppvz_for_pay || 0,
          penalty: ret.penalty || 0,
        })
      }
    }
    
    // Создаем список всех артикулов из обоих таблиц
    const allArticles = new Set<string>()
    for (const sale of sales) {
      if (sale.sa_name) allArticles.add(sale.sa_name)
    }
    for (const ret of returns) {
      if (ret.sa_name) allArticles.add(ret.sa_name)
    }

    // Группируем продажи по артикулам
    const salesByArticle = new Map<string, ReportSale[]>()
    for (const sale of sales) {
      const article = sale.sa_name
      if (!salesByArticle.has(article)) {
        salesByArticle.set(article, [])
      }
      salesByArticle.get(article)!.push(sale)
    }

    // Группируем возвраты по артикулам (на случай, если по ним нет продаж в этом периоде)
    const returnsByArticle = new Map<string, ReportReturn[]>()
    for (const ret of returns) {
      const article = ret.sa_name
      if (!returnsByArticle.has(article)) {
        returnsByArticle.set(article, [])
      }
      returnsByArticle.get(article)!.push(ret)
    }

    // Создаем структуру данных
    const rows: SummaryRow[] = []

    for (const sa_name of allArticles) {
      const articleSales = salesByArticle.get(sa_name) || []
      const articleReturns = returnsByArticle.get(sa_name) || []
      
      // Группируем по размерам (собираем все уникальные размеры для этого артикула)
      const allSizes = new Set<string>()
      const salesBySize = new Map<string, ReportSale[]>()
      const returnsBySize = new Map<string, ReportReturn[]>()
      
      for (const sale of articleSales) {
        const sizeKey = (!sale.ts_name || sale.ts_name.trim() === '') ? '' : sale.ts_name.trim()
        allSizes.add(sizeKey)
        if (!salesBySize.has(sizeKey)) salesBySize.set(sizeKey, [])
        salesBySize.get(sizeKey)!.push(sale)
      }
      
      for (const ret of articleReturns) {
        const sizeKey = (!ret.ts_name || ret.ts_name.trim() === '') ? '' : ret.ts_name.trim()
        allSizes.add(sizeKey)
        if (!returnsBySize.has(sizeKey)) returnsBySize.set(sizeKey, [])
        returnsBySize.get(sizeKey)!.push(ret)
      }
      
      // Создаем строку для артикула
      const groupRow: SummaryRow = {
        sa_name,
        subject_name: articleSales[0]?.subject_name || articleReturns[0]?.subject_name || '',
        isExpanded: false,
        isGroupRow: true,
        quantity: 0,
        salesAmount: 0,
        returnsAmount: 0,
        deliveryAmount: 0,
        returnAmount: 0,
        actualReturns: 0,
        realizationBeforeSppAmount: 0,
        realizationAfterSppAmount: 0,
        sppPercent: 0,
        buyoutPercent: 0,
        logistics: 0,
        penalty: 0,
        netPay: 0,
        wbCommissionAmount: 0,
        wbCommissionPercent: 0,
        children: [],
      }

      // Создаем строки для размеров
      for (const ts_name of allSizes) {
        const sizeSales = salesBySize.get(ts_name) || []
        const sizeReturns = returnsBySize.get(ts_name) || []
        
        const sizeSalesData = this.aggregateSales(sizeSales)
        const sizeReturnsData = this.aggregateReturns(sizeReturns)

        // Реализация до СПП: retail_price (продажи) - retail_price (возвраты)
        const realizationBeforeSppAmount = parseFloat((sizeSalesData.retail_price - sizeReturnsData.retail_price).toFixed(2))
        
        // Реализация после СПП: retail_amount (продажи) - retail_amount (возвраты)
        const realizationAfterSppAmount = parseFloat((sizeSalesData.retail_amount - sizeReturnsData.retail_amount).toFixed(2))
        
        console.log(`[SummaryService] Расчет для ${sa_name} ${ts_name}:`)
        console.log(`  Sales retail_price: ${sizeSalesData.retail_price}, Sales quantity: ${sizeSalesData.quantity}`)
        console.log(`  Returns retail_price: ${sizeReturnsData.retail_price}, Returns quantity: ${sizeReturnsData.quantity}`)
        console.log(`  Realization Before SPP: ${realizationBeforeSppAmount}`)
        console.log(`  Sales retail_amount: ${sizeSalesData.retail_amount}, Returns retail_amount: ${sizeReturnsData.retail_amount}`)
        console.log(`  Realization After SPP: ${realizationAfterSppAmount}`)
        // Рассчитываем процент выкупа по количеству
        const realizationQty = sizeSalesData.quantity - sizeReturnsData.quantity
        const buyoutPercent = sizeSalesData.delivery_amount > 0 
          ? Math.round(((realizationQty / sizeSalesData.delivery_amount) * 100) * 10) / 10
          : 0

        const childRow: SummaryRow = {
          sa_name,
          subject_name: groupRow.subject_name,
          ts_name,
          isExpanded: false,
          isGroupRow: false,
          quantity: sizeSalesData.quantity,
          salesAmount: sizeSalesData.retail_amount,
          returnsAmount: sizeReturnsData.retail_amount,
          deliveryAmount: sizeSalesData.delivery_amount,
          returnAmount: sizeSalesData.return_amount,
          actualReturns: sizeReturnsData.quantity,
          realizationBeforeSppAmount,
          realizationAfterSppAmount,
          sppPercent: realizationBeforeSppAmount > 0 
            ? parseFloat(((realizationBeforeSppAmount - realizationAfterSppAmount) / realizationBeforeSppAmount * 100).toFixed(1))
            : 0,
          buyoutPercent,
          logistics: sizeSalesData.delivery_rub + sizeReturnsData.delivery_rub,
          penalty: sizeSalesData.penalty + sizeReturnsData.penalty,
          netPay: parseFloat((sizeSalesData.ppvz_for_pay - sizeReturnsData.ppvz_for_pay).toFixed(2)),
          wbCommissionAmount: parseFloat((realizationBeforeSppAmount - parseFloat((sizeSalesData.ppvz_for_pay - sizeReturnsData.ppvz_for_pay).toFixed(2))).toFixed(2)),
          wbCommissionPercent: realizationBeforeSppAmount > 0
            ? parseFloat((((realizationBeforeSppAmount - parseFloat((sizeSalesData.ppvz_for_pay - sizeReturnsData.ppvz_for_pay).toFixed(2))) / realizationBeforeSppAmount) * 100).toFixed(1))
            : 0,
        }

        // Проверяем активность
        const hasActivity = 
          childRow.quantity !== 0 || 
          childRow.salesAmount !== 0 || 
          childRow.deliveryAmount !== 0 || 
          childRow.actualReturns !== 0 || 
          childRow.logistics !== 0 || 
          childRow.penalty !== 0 || 
          childRow.netPay !== 0 ||
          childRow.wbCommissionAmount !== 0 ||
          childRow.wbCommissionPercent !== 0 ||
          childRow.returnAmount !== 0 ||
          childRow.realizationBeforeSppAmount !== 0 ||
          childRow.realizationAfterSppAmount !== 0

        if (hasActivity) {
          groupRow.quantity += childRow.quantity
          groupRow.salesAmount += childRow.salesAmount
          groupRow.deliveryAmount += childRow.deliveryAmount
          groupRow.returnAmount += childRow.returnAmount
          groupRow.actualReturns += childRow.actualReturns
          groupRow.returnsAmount += childRow.returnsAmount
          groupRow.realizationBeforeSppAmount += childRow.realizationBeforeSppAmount
          groupRow.realizationAfterSppAmount += childRow.realizationAfterSppAmount
          groupRow.sppPercent = groupRow.realizationBeforeSppAmount > 0
            ? parseFloat(((groupRow.realizationBeforeSppAmount - groupRow.realizationAfterSppAmount) / groupRow.realizationBeforeSppAmount * 100).toFixed(1))
            : 0
          groupRow.logistics += childRow.logistics
          groupRow.penalty += childRow.penalty
          groupRow.netPay = parseFloat((groupRow.netPay + childRow.netPay).toFixed(2))
          groupRow.wbCommissionAmount = parseFloat((groupRow.wbCommissionAmount + childRow.wbCommissionAmount).toFixed(2))
          groupRow.wbCommissionPercent = groupRow.realizationBeforeSppAmount > 0
            ? parseFloat(((groupRow.wbCommissionAmount / groupRow.realizationBeforeSppAmount) * 100).toFixed(1))
            : 0

          groupRow.children!.push(childRow)
        }
      }

      if (groupRow.children!.length > 0) {
        const groupRealizationQty = groupRow.quantity - groupRow.actualReturns
        groupRow.buyoutPercent = groupRow.deliveryAmount > 0
          ? Math.round(((groupRealizationQty / groupRow.deliveryAmount) * 100) * 10) / 10
          : 0

        rows.push(groupRow)
      }
    }

    // Сортируем по названию артикула
    rows.sort((a, b) => a.sa_name.localeCompare(b.sa_name))

    return rows
  }

  /**
   * Приоритизирует данные: выбирает финальные (is_final = true), если они есть, иначе временные.
   * Также нормализует дату и размер для корректного сопоставления.
   */
  private prioritizeFinalData<T extends ReportSale | ReportReturn>(data: T[]): T[] {
    const grouped = new Map<string, { final?: T, temp?: T[] }>()

    for (const item of data) {
      // Нормализуем дату (убираем время если есть)
      const date = item.rr_dt.split('T')[0]
      // Нормализуем размер
      const tsName = (!item.ts_name || item.ts_name.trim() === '') ? '' : item.ts_name.trim()
      
      const key = `${date}|${item.nm_id}|${tsName}`
      const isFinal = item.is_final === true
      const group = grouped.get(key) || { temp: [] }

      if (isFinal) {
        group.final = item
      } else {
        group.temp!.push(item)
      }

      grouped.set(key, group)
    }

    const result: T[] = []
    for (const group of grouped.values()) {
      if (group.final) {
        // Если есть финальная запись, берем её (она уже агрегирована)
        result.push(group.final)
      } else if (group.temp && group.temp.length > 0) {
        // Если только временные, берем все (они будут агрегированы в getSummaryData)
        result.push(...group.temp)
      }
    }

    return result
  }

  /**
   * Применяет фильтры к данным
   */
  private applyFilters<T extends ReportSale | ReportReturn>(
    data: T[],
    filters: SummaryFilters
  ): T[] {
    let filtered = [...data]

    // Нормализуем фильтры дат
    const dateFrom = filters.dateFrom ? filters.dateFrom.split('T')[0] : null
    const dateTo = filters.dateTo ? filters.dateTo.split('T')[0] : null

    // Фильтр по дате
    if (dateFrom) {
      filtered = filtered.filter(item => item.rr_dt.split('T')[0] >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter(item => item.rr_dt.split('T')[0] <= dateTo)
    }

    // Фильтр по категориям
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(item => 
        filters.categories!.includes(item.subject_name)
      )
    }

    // Поиск по артикулу
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      filtered = filtered.filter(item =>
        item.sa_name.toLowerCase().includes(query)
      )
    }

    // Фильтр по артикулам продавца
    if (filters.vendorCodes && filters.vendorCodes.length > 0) {
      filtered = filtered.filter(item =>
        filters.vendorCodes!.includes(item.sa_name)
      )
    }

    return filtered
  }

  /**
   * Создает ключ для поиска возвратов
   */
  private createKey(sa_name: string, ts_name: string): string {
    const normalizedTsName = (!ts_name || ts_name.trim() === '') ? '' : ts_name.trim()
    return `${sa_name}|${normalizedTsName}`
  }

  /**
   * Агрегирует продажи
   */
  private aggregateSales(sales: ReportSale[]) {
    const result = sales.reduce(
      (acc, sale) => ({
        quantity: acc.quantity + (sale.quantity || 0),
        retail_price: acc.retail_price + ((sale.retail_price || 0) * (sale.quantity || 0)),
        retail_amount: acc.retail_amount + (sale.retail_amount || 0),
        delivery_amount: acc.delivery_amount + (sale.delivery_amount || 0),
        return_amount: acc.return_amount + (sale.return_amount || 0),
        delivery_rub: acc.delivery_rub + (sale.delivery_rub || 0),
        penalty: acc.penalty + (sale.penalty || 0),
        ppvz_for_pay: acc.ppvz_for_pay + (sale.ppvz_for_pay || 0),
      }),
      {
        quantity: 0,
        retail_price: 0,
        retail_amount: 0,
        delivery_amount: 0,
        return_amount: 0,
        delivery_rub: 0,
        penalty: 0,
        ppvz_for_pay: 0,
      }
    )
    
    return result
  }

  /**
   * Агрегирует возвраты
   */
  private aggregateReturns(returns: ReportReturn[]) {
    const result = returns.reduce(
      (acc, ret) => ({
        quantity: acc.quantity + (ret.quantity || 0),
        retail_price: acc.retail_price + ((ret.retail_price || 0) * (ret.quantity || 0)),
        retail_amount: acc.retail_amount + (ret.retail_amount || 0),
        delivery_rub: acc.delivery_rub + (ret.delivery_rub || 0),
        penalty: acc.penalty + (ret.penalty || 0),
        ppvz_for_pay: acc.ppvz_for_pay + (ret.ppvz_for_pay || 0),
      }),
      {
        quantity: 0,
        retail_price: 0,
        retail_amount: 0,
        delivery_rub: 0,
        penalty: 0,
        ppvz_for_pay: 0,
      }
    )
    
    return result
  }

  /**
   * Вычисляет итоговую строку
   */
  calculateTotal(rows: SummaryRow[]): SummaryRow {
    const total: SummaryRow = {
      sa_name: 'Итого',
      subject_name: '',
      isExpanded: false,
      isGroupRow: false,
      quantity: 0,
      salesAmount: 0,
      returnsAmount: 0,
      deliveryAmount: 0,
      returnAmount: 0,
      actualReturns: 0,
      realizationBeforeSppAmount: 0,
      realizationAfterSppAmount: 0,
      sppPercent: 0,
      buyoutPercent: 0,
      logistics: 0,
      penalty: 0,
      netPay: 0,
      wbCommissionAmount: 0,
      wbCommissionPercent: 0,
    }

    for (const row of rows) {
      total.quantity += row.quantity
      total.salesAmount += row.salesAmount
      total.returnsAmount += row.returnsAmount
      total.deliveryAmount += row.deliveryAmount
      total.returnAmount += row.returnAmount
      total.actualReturns += row.actualReturns
      total.realizationBeforeSppAmount = parseFloat((total.realizationBeforeSppAmount + row.realizationBeforeSppAmount).toFixed(2))
      total.realizationAfterSppAmount = parseFloat((total.realizationAfterSppAmount + row.realizationAfterSppAmount).toFixed(2))
      // Расчет sppPercent для итоговой строки
      const totalSppAmount = total.realizationBeforeSppAmount - total.realizationAfterSppAmount
      total.sppPercent = total.realizationBeforeSppAmount > 0
        ? parseFloat(((totalSppAmount / total.realizationBeforeSppAmount) * 100).toFixed(1))
        : 0
      total.logistics += row.logistics
      total.penalty += row.penalty
      total.netPay = parseFloat((total.netPay + row.netPay).toFixed(2))
      total.wbCommissionAmount = parseFloat((total.wbCommissionAmount + row.wbCommissionAmount).toFixed(2))
      // Расчет wbCommissionPercent для итоговой строки
      total.wbCommissionPercent = total.realizationBeforeSppAmount > 0
        ? parseFloat(((total.wbCommissionAmount / total.realizationBeforeSppAmount) * 100).toFixed(1))
        : 0
    }

    // Рассчитываем процент выкупа для итоговой строки по количеству
    const totalRealizationQty = total.quantity - total.actualReturns
    total.buyoutPercent = total.deliveryAmount > 0
      ? Math.round(((totalRealizationQty / total.deliveryAmount) * 100) * 10) / 10
      : 0

    return total
  }

  /**
   * Получает уникальные категории
   */
  async getCategories(): Promise<string[]> {
    const sales = await this.saleRepository.getAll()
    const categories = new Set<string>()
    
    for (const sale of sales) {
      if (sale.subject_name) {
        categories.add(sale.subject_name)
      }
    }
    
    return Array.from(categories).sort()
  }
}
