import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../db/db'
import type { ISale, IReturn, ILogistics, IPenalty, IDeduction, IAdvCost, IAcceptanceCost, IStorageCost, IProductOrder, IProductCard, IUnitCost, IWarehouseRemain } from '../types/db'

/**
 * Store для аналитических данных
 * Обеспечивает ступенчатую загрузку данных из БД:
 * 1. Приоритетная загрузка последнего месяца
 * 2. Фоновая загрузка данных за год
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  // State: Данные из финансовых таблиц
  const sales = ref<ISale[]>([])
  const returns = ref<IReturn[]>([])
  const logistics = ref<ILogistics[]>([])
  const penalties = ref<IPenalty[]>([])
  const deductions = ref<IDeduction[]>([])
  
  // State: Данные из таблиц затрат
  const advCosts = ref<IAdvCost[]>([])
  const storageCosts = ref<IStorageCost[]>([])
  const acceptanceCosts = ref<IAcceptanceCost[]>([])
  
  // State: Данные из таблиц статистики
  const productOrders = ref<IProductOrder[]>([])
  
  // State: Справочники (загружаются полностью)
  const productCards = ref<IProductCard[]>([])
  const unitCosts = ref<IUnitCost[]>([])
  const warehouseRemains = ref<IWarehouseRemain[]>([])
  
  // State: Флаги загрузки
  const isInitialLoading = ref<boolean>(false)
  const isHistoryLoading = ref<boolean>(false)
  const isReady = ref<boolean>(false)
  
  // State: Фильтры для агрегации
  const filters = ref<{
    dateFrom: string | null
    dateTo: string | null
  }>({
    dateFrom: null,
    dateTo: null,
  })

  // State: Глобальная налоговая ставка
  const globalTaxRate = ref<number>(6)

  /**
   * Форматирует дату в формат YYYY-MM-DD
   */
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  /**
   * Загружает все данные из БД с ступенчатой загрузкой:
   * 1. Приоритетная загрузка последнего месяца
   * 2. Фоновая загрузка данных за год (от года назад до месяца назад)
   */
  const loadAllDataFromDb = async () => {
    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
    const oneYearAgo = new Date(now)
    oneYearAgo.setDate(oneYearAgo.getDate() - 365)

    const dateNow = formatDate(now)
    const dateOneMonthAgo = formatDate(oneMonthAgo)
    const dateOneYearAgo = formatDate(oneYearAgo)

    console.log(`[AnalyticsStore] Начало загрузки данных`)
    console.log(`[AnalyticsStore] Период приоритетной загрузки: ${dateOneMonthAgo} - ${dateNow}`)
    console.log(`[AnalyticsStore] Период фоновой загрузки: ${dateOneYearAgo} - ${dateOneMonthAgo}`)

    // Этап 1: Приоритетная загрузка последнего месяца
    console.log('⏳ Начинаю загрузку первого месяца данных...')
    const startTimeInitial = Date.now()
    isInitialLoading.value = true

    try {
      // Загружаем данные за последний месяц параллельно
      const [
        salesData,
        returnsData,
        logisticsData,
        penaltiesData,
        deductionsData,
        advCostsData,
        storageCostsData,
        acceptanceCostsData,
        productOrdersData,
        productCardsData,
        unitCostsData,
      ] = await Promise.all([
        // Финансовые таблицы
        db.sales.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.returns.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.logistics.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.penalties.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.deductions.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        // Таблицы затрат
        db.adv_costs.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.storage_costs.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        db.acceptance_costs.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        // Статистика заказов
        db.product_orders.where('dt').between(dateOneMonthAgo, dateNow, true, true).toArray(),
        // Справочники (загружаем полностью)
        db.product_cards.toArray(),
        db.unit_costs.toArray(),
      ])

      // Сохраняем данные в state
      sales.value = salesData
      returns.value = returnsData
      logistics.value = logisticsData
      penalties.value = penaltiesData
      deductions.value = deductionsData
      advCosts.value = advCostsData
      storageCosts.value = storageCostsData
      acceptanceCosts.value = acceptanceCostsData
      productOrders.value = productOrdersData
      productCards.value = productCardsData
      unitCosts.value = unitCostsData
      warehouseRemains.value = await db.warehouse_remains.toArray()

      // Загружаем глобальную налоговую ставку из настроек
      const taxSetting = await db.settings.get('global_tax')
      if (taxSetting) {
        globalTaxRate.value = parseFloat(taxSetting.value) || 6
      }

      isReady.value = true
      isInitialLoading.value = false

      const initialLoadTime = Date.now() - startTimeInitial
      console.log(`[AnalyticsStore] ✅ Приоритетная загрузка завершена за ${initialLoadTime} мс`)
      console.log(`✅ Первый месяц загружен: ${sales.value.length} записей продаж в памяти.`)
      console.log(`[AnalyticsStore]   - Продажи: ${salesData.length}`)
      console.log(`[AnalyticsStore]   - Возвраты: ${returnsData.length}`)
      console.log(`[AnalyticsStore]   - Логистика: ${logisticsData.length}`)
      console.log(`[AnalyticsStore]   - Реклама: ${advCostsData.length}`)
      console.log(`[AnalyticsStore]   - Хранение: ${storageCostsData.length}`)
      console.log(`[AnalyticsStore]   - Приемка: ${acceptanceCostsData.length}`)
      console.log(`[AnalyticsStore]   - Заказы: ${productOrdersData.length}`)
      console.log(`[AnalyticsStore]   - Карточки товаров: ${productCardsData.length}`)
      console.log(`[AnalyticsStore]   - Себестоимость: ${unitCostsData.length}`)

      // Этап 2: Фоновая загрузка данных за год (от года назад до месяца назад)
      isHistoryLoading.value = true

      // Запускаем фоновую загрузку асинхронно (не блокируем UI)
      loadHistoryData(dateOneYearAgo, dateOneMonthAgo).catch(error => {
        console.error('[AnalyticsStore] Ошибка при фоновой загрузке истории:', error)
        isHistoryLoading.value = false
      })
    } catch (error) {
      console.error('[AnalyticsStore] Ошибка при приоритетной загрузке:', error)
      isInitialLoading.value = false
      throw error
    }
  }

  /**
   * Фоновая загрузка исторических данных
   */
  const loadHistoryData = async (dateFrom: string, dateTo: string) => {
    console.log(`[AnalyticsStore] Начало фоновой загрузки истории: ${dateFrom} - ${dateTo}`)
    const startTimeHistory = Date.now()

    try {
      // Загружаем исторические данные параллельно
      const [
        salesHistory,
        returnsHistory,
        logisticsHistory,
        penaltiesHistory,
        deductionsHistory,
        advCostsHistory,
        storageCostsHistory,
        acceptanceCostsHistory,
        productOrdersHistory,
      ] = await Promise.all([
        db.sales.where('dt').between(dateFrom, dateTo, true, false).toArray(), // false = не включая dateTo (так как эти данные уже загружены)
        db.returns.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.logistics.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.penalties.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.deductions.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.adv_costs.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.storage_costs.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.acceptance_costs.where('dt').between(dateFrom, dateTo, true, false).toArray(),
        db.product_orders.where('dt').between(dateFrom, dateTo, true, false).toArray(),
      ])

      // Добавляем исторические данные в существующие массивы
      sales.value.push(...salesHistory)
      returns.value.push(...returnsHistory)
      logistics.value.push(...logisticsHistory)
      penalties.value.push(...penaltiesHistory)
      deductions.value.push(...deductionsHistory)
      advCosts.value.push(...advCostsHistory)
      storageCosts.value.push(...storageCostsHistory)
      acceptanceCosts.value.push(...acceptanceCostsHistory)
      productOrders.value.push(...productOrdersHistory)

      isHistoryLoading.value = false

      const historyLoadTime = Date.now() - startTimeHistory
      console.log(`[AnalyticsStore] ✅ Фоновая загрузка истории завершена за ${historyLoadTime} мс`)
      console.log(`🚀 История за год подгружена! Всего в памяти: ${sales.value.length} записей продаж.`)
      console.log(`[AnalyticsStore]   - Продажи (добавлено): ${salesHistory.length}`)
      console.log(`[AnalyticsStore]   - Возвраты (добавлено): ${returnsHistory.length}`)
      console.log(`[AnalyticsStore]   - Логистика (добавлено): ${logisticsHistory.length}`)
      console.log(`[AnalyticsStore]   - Реклама (добавлено): ${advCostsHistory.length}`)
      console.log(`[AnalyticsStore]   - Хранение (добавлено): ${storageCostsHistory.length}`)
      console.log(`[AnalyticsStore]   - Приемка (добавлено): ${acceptanceCostsHistory.length}`)
      console.log(`[AnalyticsStore]   - Заказы (добавлено): ${productOrdersHistory.length}`)
      console.log(`[AnalyticsStore] Всего записей после загрузки истории: ${totalRecordsCount.value}`)
    } catch (error) {
      console.error('[AnalyticsStore] Ошибка при фоновой загрузке истории:', error)
      isHistoryLoading.value = false
      throw error
    }
  }

  /**
   * Геттер: суммарное количество записей во всех массивах
   */
  const totalRecordsCount = computed(() => {
    return (
      sales.value.length +
      returns.value.length +
      logistics.value.length +
      penalties.value.length +
      deductions.value.length +
      advCosts.value.length +
      storageCosts.value.length +
      acceptanceCosts.value.length +
      productOrders.value.length +
      productCards.value.length +
      unitCosts.value.length +
      warehouseRemains.value.length
    )
  })

  /**
   * Геттер: агрегированный отчет по товарам за выбранный период (иерархия: Артикул -> Размеры)
   */
  const aggregatedReport = computed(() => {
    const dateFrom = filters.value.dateFrom
    const dateTo = filters.value.dateTo

    // Если фильтры не установлены, возвращаем пустой массив
    if (!dateFrom || !dateTo) {
      return []
    }

    // Фильтруем данные по периоду
    const filteredSales = sales.value.filter(sale => {
      return sale.dt >= dateFrom && sale.dt <= dateTo
    })

    const filteredReturns = returns.value.filter(ret => {
      return ret.dt >= dateFrom && ret.dt <= dateTo
    })

    const filteredOrders = productOrders.value.filter(order => {
      return order.dt >= dateFrom && order.dt <= dateTo
    })

    const filteredLogistics = logistics.value.filter(log => {
      return log.dt >= dateFrom && log.dt <= dateTo
    })

    const filteredAdvCosts = advCosts.value.filter(adv => {
      return adv.dt >= dateFrom && adv.dt <= dateTo
    })

    const filteredPenalties = penalties.value.filter(penalty => {
      return penalty.dt >= dateFrom && penalty.dt <= dateTo
    })

    const filteredStorageCosts = storageCosts.value.filter(storage => {
      return storage.dt >= dateFrom && storage.dt <= dateTo
    })

    // Создаем Map для агрегации по nmId -> size
    type SizeAggregate = {
      sz: string
      ordersCount: number
      ordersSum: number
      salesCount: number
      returnsCount: number
      deliveryCount: number
      cancelCount: number
      revenue: number // реализация до СПП (retail_price)
      revenueAfterSpp: number // после СПП (retail_amount продаж - retail_amount возвратов)
      sellerAmount: number // к перечислению (равно revenueAfterSpp)
      returnsRevenue: number // сумма возвратов (retail_price из returns)
      returnsPa: number // сумма возвратов retail_amount (для реализации после СПП)
      netSalesCount: number // чистые продажи (salesCount - returnsCount)
      netRevenue: number // чистая реализация (revenue - returnsRevenue)
      buyoutPercent: number // процент выкупа (netSalesCount / deliveryCount * 100)
      sppAmount: number // сумма СПП (revenueBeforeSpp - revenueAfterSpp)
      sppPercent: number // процент СПП (sppAmount / revenueBeforeSpp * 100)
      salesPz: number // сумма pz (ppvz_for_pay) из продаж
      returnsPz: number // сумма pz (ppvz_for_pay) из возвратов
      transferAmount: number // перечисления (pz продаж - pz возвратов)
      commissionAmount: number // комиссия WB (revenueBeforeSpp - transferAmount)
      commissionPercent: number // процент комиссии (commissionAmount / revenueBeforeSpp * 100)
      logisticsCosts: number
      storageCost: number // затраты на хранение
      drrSales: number // ДРР по продажам (для размеров всегда 0, реклама только на уровне артикула)
      drrOrders: number // ДРР по заказам (для размеров всегда 0, реклама только на уровне артикула)
      drrOrdersForecast: number // ДРР прогнозный (для размеров всегда 0, реклама только на уровне артикула)
      unitCosts: number
      taxes: number
    }

    type ProductAggregate = {
      ni: number
      // Данные из productCards
      title: string
      img: string
      bc: string
      sa: string
      sj: string
      // Агрегированные данные по размерам
      sizes: SizeAggregate[]
      // Итоги на уровне артикула
      ordersCount: number
      ordersSum: number
      salesCount: number
      returnsCount: number
      deliveryCount: number
      cancelCount: number
      revenue: number
      revenueAfterSpp: number
      sellerAmount: number
      returnsRevenue: number // сумма возвратов (retail_price из returns)
      returnsPa: number // сумма возвратов retail_amount (для реализации после СПП)
      netSalesCount: number // чистые продажи (salesCount - returnsCount)
      netRevenue: number // чистая реализация (revenue - returnsRevenue)
      buyoutPercent: number // процент выкупа (netSalesCount / deliveryCount * 100)
      sppAmount: number // сумма СПП (revenueBeforeSpp - revenueAfterSpp)
      sppPercent: number // процент СПП (sppAmount / revenueBeforeSpp * 100)
      salesPz: number // сумма pz (ppvz_for_pay) из продаж
      returnsPz: number // сумма pz (ppvz_for_pay) из возвратов
      transferAmount: number // перечисления (pz продаж - pz возвратов)
      commissionAmount: number // комиссия WB (revenueBeforeSpp - transferAmount)
      commissionPercent: number // процент комиссии (commissionAmount / revenueBeforeSpp * 100)
      advCosts: number
      logisticsCosts: number
      storageCost: number // затраты на хранение
      drrSales: number // ДРР по продажам (advCosts / netRevenue * 100)
      drrOrders: number // ДРР по заказам (advCosts / ordersSum * 100)
      drrOrdersForecast: number // ДРР прогнозный (advCosts / (ordersSum * buyoutPercent / 100) * 100)
      penaltiesCosts: number
      unitCosts: number
      taxes: number
      stocks: number
    }

    const productsMap = new Map<number, ProductAggregate>()
    const sizesMap = new Map<string, SizeAggregate>()

    // Функция для получения или создания агрегата размера
    const getOrCreateSize = (ni: number, sz: string): SizeAggregate => {
      const key = `${ni}_${sz}`
      if (!sizesMap.has(key)) {
        sizesMap.set(key, {
          sz,
          ordersCount: 0,
          ordersSum: 0,
          salesCount: 0,
          returnsCount: 0,
          deliveryCount: 0,
          cancelCount: 0,
          revenue: 0,
          revenueAfterSpp: 0,
          sellerAmount: 0,
          returnsRevenue: 0,
          returnsPa: 0,
          netSalesCount: 0,
          netRevenue: 0,
          buyoutPercent: 0,
          sppAmount: 0,
          sppPercent: 0,
          salesPz: 0,
          returnsPz: 0,
          transferAmount: 0,
          commissionAmount: 0,
          commissionPercent: 0,
          logisticsCosts: 0,
          storageCost: 0,
          drrSales: 0,
          drrOrders: 0,
          drrOrdersForecast: 0,
          unitCosts: 0,
          taxes: 0,
        })
      }
      return sizesMap.get(key)!
    }

    // Функция для получения или создания агрегата артикула
    const getOrCreateProduct = (ni: number, bc?: string, sa?: string, sj?: string): ProductAggregate => {
      if (!productsMap.has(ni)) {
        productsMap.set(ni, {
          ni,
          title: '',
          img: '',
          bc: bc || '',
          sa: sa || '',
          sj: sj || '',
          sizes: [],
          ordersCount: 0,
          ordersSum: 0,
          salesCount: 0,
          returnsCount: 0,
          deliveryCount: 0,
          cancelCount: 0,
          revenue: 0,
          revenueAfterSpp: 0,
          sellerAmount: 0,
          returnsRevenue: 0,
          returnsPa: 0,
          netSalesCount: 0,
          netRevenue: 0,
          buyoutPercent: 0,
          sppAmount: 0,
          sppPercent: 0,
          salesPz: 0,
          returnsPz: 0,
          transferAmount: 0,
          commissionAmount: 0,
          commissionPercent: 0,
          advCosts: 0,
          logisticsCosts: 0,
          storageCost: 0,
          drrSales: 0,
          drrOrders: 0,
          drrOrdersForecast: 0,
          penaltiesCosts: 0,
          unitCosts: 0,
          taxes: 0,
          stocks: 0,
        })
      }
      return productsMap.get(ni)!
    }

    // Агрегируем продажи (sales) - распределяем по размерам
    for (const sale of filteredSales) {
      const product = getOrCreateProduct(sale.ni, sale.bc, sale.sa, sale.sj)
      const revenue = sale.pv || 0 // retail_price (для реализации до СПП)
      const revenueAfterSpp = sale.pa || 0 // retail_amount (для реализации после СПП)
      const pz = sale.pz || 0 // ppvz_for_pay (для перечислений)
      const quantity = sale.qt || 0

      product.revenue += revenue
      product.revenueAfterSpp += revenueAfterSpp
      product.salesPz += pz
      product.salesCount += quantity

      // Если есть размер, агрегируем по размеру
      if (sale.sz) {
        const size = getOrCreateSize(sale.ni, sale.sz)
        size.revenue += revenue
        size.revenueAfterSpp += revenueAfterSpp
        size.salesPz += pz
        size.salesCount += quantity
      }
    }

    // Агрегируем возвраты (returns) - распределяем по размерам
    for (const ret of filteredReturns) {
      const product = getOrCreateProduct(ret.ni, ret.bc, ret.sa, ret.sj)
      const quantity = ret.qt || 0
      const revenue = ret.pv || 0 // retail_price из возвратов (для реализации до СПП)
      const revenuePa = ret.pa || 0 // retail_amount из возвратов (для реализации после СПП)
      const pz = ret.pz || 0 // ppvz_for_pay из возвратов (перечисления возвратов)

      product.returnsCount += quantity
      product.returnsRevenue += revenue
      product.returnsPa += revenuePa
      product.returnsPz += pz

      // Если есть размер, агрегируем по размеру
      if (ret.sz) {
        const size = getOrCreateSize(ret.ni, ret.sz)
        size.returnsCount += quantity
        size.returnsRevenue += revenue
        size.returnsPa += revenuePa
        size.returnsPz += pz
      }
    }

    // Агрегируем логистику - распределяем по размерам
    for (const log of filteredLogistics) {
      const product = getOrCreateProduct(log.ni, log.bc, log.sa, log.sj)
      const logisticsCost = log.dr || 0 // delivery_rub
      const deliveryAmount = log.dl || 0 // delivery_amount (количество доставок)

      product.logisticsCosts += logisticsCost
      product.deliveryCount += deliveryAmount // суммируем количество доставок
      product.cancelCount += (log.rt || 0) > 0 ? 1 : 0 // return_amount

      // Если есть размер, агрегируем по размеру
      if (log.sz) {
        const size = getOrCreateSize(log.ni, log.sz)
        size.logisticsCosts += logisticsCost
        size.deliveryCount += deliveryAmount // суммируем количество доставок
        size.cancelCount += (log.rt || 0) > 0 ? 1 : 0
      }
    }

    // Агрегируем заказы (product_orders) - только на уровне артикула (нет размера в product_orders)
    for (const order of filteredOrders) {
      const product = getOrCreateProduct(order.ni, order.bc, undefined, order.sj)
      product.ordersCount += order.oc || 0 // orderCount
      product.ordersSum += order.os || 0 // orderSum
    }

    // Агрегируем рекламу (adv_costs) - только на уровне артикула
    for (const adv of filteredAdvCosts) {
      const product = getOrCreateProduct(adv.ni)
      product.advCosts += adv.costs || 0
    }

    // Агрегируем штрафы (penalties) - только на уровне артикула
    for (const penalty of filteredPenalties) {
      const product = getOrCreateProduct(penalty.ni, penalty.bc, penalty.sa, penalty.sj)
      product.penaltiesCosts += penalty.pn || 0
    }

    // Агрегируем хранение (storage) - распределяем по размерам
    for (const storage of filteredStorageCosts) {
      const product = getOrCreateProduct(storage.ni, storage.bc, storage.sa, storage.sj)
      const cost = storage.sc || 0
      product.storageCost += cost

      // Если есть размер, агрегируем по размеру
      if (storage.sz) {
        const size = getOrCreateSize(storage.ni, storage.sz)
        size.storageCost += cost
      }
    }

    // Добавляем остатки на складах (stocks) - только на уровне артикула
    for (const remain of warehouseRemains.value) {
      const product = getOrCreateProduct(remain.ni, remain.bc, remain.sa, remain.sj)
      product.stocks += remain.q_wh || 0
    }

    // Считаем себестоимость и налоги для каждого размера и артикула
    const unitCostsMap = new Map<number, { cost: number; taxRate: number }>()
    for (const unitCost of unitCosts.value) {
      unitCostsMap.set(unitCost.ni, {
        cost: unitCost.cost,
        taxRate: unitCost.taxRate || 0,
      })
    }

    // Соединяем с productCards для получения фото и названия
    const productCardsMap = new Map<number, IProductCard>()
    for (const card of productCards.value) {
      if (!productCardsMap.has(card.ni)) {
        productCardsMap.set(card.ni, card)
      }
    }

    // Обогащаем данные из productCards и считаем себестоимость/налоги
    for (const [ni, product] of productsMap.entries()) {
      const card = productCardsMap.get(ni)
      if (card) {
        product.title = card.title || ''
        product.img = card.img || ''
        if (!product.bc) product.bc = card.bc || ''
        if (!product.sa) product.sa = card.sa || ''
        if (!product.sj) product.sj = card.sj || ''
      }

      const unitCostData = unitCostsMap.get(ni)
      // Используем налоговую ставку из unitCosts, если указана, иначе глобальную ставку
      const taxRate = unitCostData?.taxRate || globalTaxRate.value
      const unitCost = unitCostData?.cost || 0

      // Собираем размеры для этого артикула и фильтруем только активные
      const productSizes: SizeAggregate[] = []
      for (const [key, size] of sizesMap.entries()) {
        if (key.startsWith(`${ni}_`)) {
          // Считаем себестоимость для размера
          size.unitCosts = size.salesCount * unitCost
          
          // Вычисляем чистые показатели
          size.netSalesCount = size.salesCount - size.returnsCount
          size.netRevenue = size.revenue - size.returnsRevenue // Реализация до СПП
          // Реализация после СПП = retail_amount продаж - retail_amount возвратов
          size.revenueAfterSpp = size.revenueAfterSpp - size.returnsPa
          size.sellerAmount = size.revenueAfterSpp // к перечислению = реализации после СПП
          
          // Считаем налоги для размера (от реализации после СПП)
          size.taxes = size.revenueAfterSpp * (taxRate / 100)
          // Вычисляем процент выкупа
          size.buyoutPercent = size.deliveryCount > 0 ? (size.netSalesCount / size.deliveryCount) * 100 : 0
          // Вычисляем СПП: revenueBeforeSpp (netRevenue) - revenueAfterSpp
          const revenueBeforeSpp = size.netRevenue // Реализация до СПП (revenue - returnsRevenue)
          size.sppAmount = revenueBeforeSpp - size.revenueAfterSpp
          size.sppPercent = revenueBeforeSpp > 0 ? (size.sppAmount / revenueBeforeSpp) * 100 : 0
          // Перечисления = перечисления продаж - перечисления возвратов (pz продаж - pz возвратов)
          size.transferAmount = size.salesPz - size.returnsPz
          // Комиссия WB = реализация до СПП - перечисления
          size.commissionAmount = revenueBeforeSpp - size.transferAmount
          size.commissionPercent = revenueBeforeSpp > 0 ? (size.commissionAmount / revenueBeforeSpp) * 100 : 0
          // ДРР не считается для размеров (реклама только на уровне артикула)
          size.drrSales = 0
          size.drrOrders = 0
          size.drrOrdersForecast = 0
          
          // Фильтруем размеры: оставляем только те, где есть активность
          if (size.ordersCount > 0 || size.salesCount > 0 || size.deliveryCount > 0 || size.revenue > 0) {
            productSizes.push(size)
          }
        }
      }

      // Сортируем размеры
      productSizes.sort((a, b) => a.sz.localeCompare(b.sz))
      product.sizes = productSizes

      // Считаем итоги на уровне артикула (суммируем из размеров, кроме advCosts и penaltiesCosts)
      product.ordersCount = product.ordersCount // уже посчитано из product_orders
      product.ordersSum = product.ordersSum // уже посчитано из product_orders
      product.salesCount = product.salesCount // уже посчитано из sales
      product.returnsCount = product.returnsCount // уже посчитано из returns
      product.deliveryCount = product.deliveryCount // уже посчитано из logistics
      product.cancelCount = product.cancelCount // уже посчитано из logistics
      product.revenue = product.revenue // уже посчитано из sales
      product.returnsRevenue = product.returnsRevenue // уже посчитано из returns
      
      // Вычисляем чистые показатели
      product.netSalesCount = product.salesCount - product.returnsCount
      product.netRevenue = product.revenue - product.returnsRevenue // Реализация до СПП
      // Реализация после СПП = retail_amount продаж - retail_amount возвратов
      product.revenueAfterSpp = product.revenueAfterSpp - product.returnsPa
      product.sellerAmount = product.revenueAfterSpp // к перечислению = реализации после СПП
      // Вычисляем процент выкупа
      product.buyoutPercent = product.deliveryCount > 0 ? (product.netSalesCount / product.deliveryCount) * 100 : 0
      // Вычисляем СПП: revenueBeforeSpp (netRevenue) - revenueAfterSpp
      const revenueBeforeSpp = product.netRevenue // Реализация до СПП (revenue - returnsRevenue)
      product.sppAmount = revenueBeforeSpp - product.revenueAfterSpp
      product.sppPercent = revenueBeforeSpp > 0 ? (product.sppAmount / revenueBeforeSpp) * 100 : 0
      // Перечисления = перечисления продаж - перечисления возвратов (pz продаж - pz возвратов)
      product.transferAmount = product.salesPz - product.returnsPz
      // Комиссия WB = реализация до СПП - перечисления
      product.commissionAmount = revenueBeforeSpp - product.transferAmount
      product.commissionPercent = revenueBeforeSpp > 0 ? (product.commissionAmount / revenueBeforeSpp) * 100 : 0
      // ДРР по продажам: (advCosts / netRevenue) * 100
      product.drrSales = revenueBeforeSpp > 0 ? (product.advCosts / revenueBeforeSpp) * 100 : 0
      // ДРР по заказам: (advCosts / ordersSum) * 100
      product.drrOrders = product.ordersSum > 0 ? (product.advCosts / product.ordersSum) * 100 : 0
      // ДРР прогнозный: (advCosts / (ordersSum * buyoutPercent / 100)) * 100
      const predictedRevenue = product.ordersSum > 0 && product.buyoutPercent > 0 
        ? product.ordersSum * (product.buyoutPercent / 100)
        : 0
      product.drrOrdersForecast = predictedRevenue > 0 ? (product.advCosts / predictedRevenue) * 100 : 0
      
      product.logisticsCosts = product.logisticsCosts // уже посчитано из logistics
      product.advCosts = product.advCosts // уже посчитано из adv_costs
      product.penaltiesCosts = product.penaltiesCosts // уже посчитано из penalties
      product.unitCosts = product.salesCount * unitCost
      // Считаем налоги для продукта (от реализации после СПП)
      product.taxes = product.revenueAfterSpp * (taxRate / 100)
    }

    // Фильтруем товары: оставляем только те, где есть активность
    // Активность = хотя бы один из показателей > 0
    const filteredProducts = Array.from(productsMap.values()).filter(product => {
      return product.ordersCount > 0 || 
             product.salesCount > 0 || 
             product.deliveryCount > 0 || 
             product.revenue > 0
    })

    return filteredProducts
  })

  /**
   * Геттер: общие итоги за выбранный период (использует aggregatedReport для расчета)
   */
  const totalSummary = computed(() => {
    const report = aggregatedReport.value

    if (report.length === 0) {
      return {
        totalOrdersCount: 0,
        totalOrdersSum: 0,
        totalDeliveryCount: 0,
        totalCancelCount: 0,
        totalReturnsCount: 0,
        totalSalesCount: 0,
        totalNetSalesCount: 0,
        totalRevenue: 0,
        totalNetRevenue: 0,
        totalRevenueAfterSpp: 0,
        totalSellerAmount: 0,
        totalBuyoutPercent: 0,
        totalSppAmount: 0,
        totalSppPercent: 0,
        totalTransferAmount: 0,
        totalCommissionAmount: 0,
        totalCommissionPercent: 0,
        totalLogistics: 0,
        totalAdvCosts: 0,
        totalDrrSales: 0,
        totalDrrOrders: 0,
        totalDrrOrdersForecast: 0,
        totalPenaltiesCosts: 0,
        totalStorageCosts: 0,
        totalAcceptanceCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
      }
    }

    // Суммируем все показатели по всем артикулам
    const totals = report.reduce(
      (acc, product) => {
        acc.totalOrdersCount += product.ordersCount
        acc.totalOrdersSum += product.ordersSum
        acc.totalDeliveryCount += product.deliveryCount
        acc.totalCancelCount += product.cancelCount
        acc.totalReturnsCount += product.returnsCount
        acc.totalSalesCount += product.salesCount
        acc.totalNetSalesCount += product.netSalesCount
        acc.totalRevenue += product.revenue
        acc.totalNetRevenue += product.netRevenue
        acc.totalRevenueAfterSpp += product.revenueAfterSpp
        acc.totalSellerAmount += product.sellerAmount
        acc.totalSppAmount += product.sppAmount
        acc.totalTransferAmount += product.transferAmount
        acc.totalCommissionAmount += product.commissionAmount
        acc.totalLogistics += product.logisticsCosts
        acc.totalStorageCosts += product.storageCost
        acc.totalAdvCosts += product.advCosts
        acc.totalPenaltiesCosts += product.penaltiesCosts
        acc.totalUnitCosts += product.unitCosts
        acc.totalTaxes += product.taxes
        return acc
      },
      {
        totalOrdersCount: 0,
        totalOrdersSum: 0,
        totalDeliveryCount: 0,
        totalCancelCount: 0,
        totalReturnsCount: 0,
        totalSalesCount: 0,
        totalNetSalesCount: 0,
        totalRevenue: 0,
        totalNetRevenue: 0,
        totalRevenueAfterSpp: 0,
        totalSellerAmount: 0,
        totalBuyoutPercent: 0,
        totalSppAmount: 0,
        totalSppPercent: 0,
        totalTransferAmount: 0,
        totalCommissionAmount: 0,
        totalCommissionPercent: 0,
        totalLogistics: 0,
        totalAdvCosts: 0,
        totalDrrSales: 0,
        totalDrrOrders: 0,
        totalDrrOrdersForecast: 0,
        totalPenaltiesCosts: 0,
        totalStorageCosts: 0,
        totalAcceptanceCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
      }
    )

    // Добавляем затраты на хранение и приемку (они не включены в aggregatedReport)
    const dateFrom = filters.value.dateFrom
    const dateTo = filters.value.dateTo

    if (dateFrom && dateTo) {
      const filteredStorageCosts = storageCosts.value.filter(storage => {
        return storage.dt >= dateFrom && storage.dt <= dateTo
      })

      const filteredAcceptanceCosts = acceptanceCosts.value.filter(acceptance => {
        return acceptance.dt >= dateFrom && acceptance.dt <= dateTo
      })

      totals.totalStorageCosts = filteredStorageCosts.reduce((sum, storage) => sum + (storage.sc || 0), 0)
      totals.totalAcceptanceCosts = filteredAcceptanceCosts.reduce((sum, acceptance) => sum + (acceptance.costs || 0), 0)
    }

    // Вычисляем средний процент выкупа по всему магазину
    totals.totalBuyoutPercent = totals.totalDeliveryCount > 0 
      ? (totals.totalNetSalesCount / totals.totalDeliveryCount) * 100 
      : 0

    // Вычисляем средний процент СПП по всему магазину
    totals.totalSppPercent = totals.totalNetRevenue > 0
      ? (totals.totalSppAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний процент комиссии по всему магазину
    totals.totalCommissionPercent = totals.totalNetRevenue > 0
      ? (totals.totalCommissionAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний ДРР по продажам: (totalAdvCosts / totalNetRevenue) * 100
    totals.totalDrrSales = totals.totalNetRevenue > 0
      ? (totals.totalAdvCosts / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний ДРР по заказам: (totalAdvCosts / totalOrdersSum) * 100
    totals.totalDrrOrders = totals.totalOrdersSum > 0
      ? (totals.totalAdvCosts / totals.totalOrdersSum) * 100
      : 0

    // Вычисляем средний ДРР прогнозный: (totalAdvCosts / (totalOrdersSum * totalBuyoutPercent / 100)) * 100
    const totalPredictedRevenue = totals.totalOrdersSum > 0 && totals.totalBuyoutPercent > 0
      ? totals.totalOrdersSum * (totals.totalBuyoutPercent / 100)
      : 0
    totals.totalDrrOrdersForecast = totalPredictedRevenue > 0
      ? (totals.totalAdvCosts / totalPredictedRevenue) * 100
      : 0

    // Формула прибыли: Выручка после СПП - Логистика - Реклама - Штрафы - Хранение - Приемка - Себестоимость - Налоги
    totals.totalProfit =
      totals.totalRevenueAfterSpp -
      totals.totalLogistics -
      totals.totalAdvCosts -
      totals.totalPenaltiesCosts -
      totals.totalStorageCosts -
      totals.totalAcceptanceCosts -
      totals.totalUnitCosts -
      totals.totalTaxes

    return totals
  })

  /**
   * Устанавливает фильтры для агрегации
   */
  const setFilters = (dateFrom: string | null, dateTo: string | null) => {
    filters.value.dateFrom = dateFrom
    filters.value.dateTo = dateTo
  }

  /**
   * Обновляет глобальную налоговую ставку
   */
  const updateGlobalTax = async (val: number) => {
    globalTaxRate.value = val
    await db.settings.put({ key: 'global_tax', value: val.toString() })
  }

  return {
    // State
    sales,
    returns,
    logistics,
    penalties,
    deductions,
    advCosts,
    storageCosts,
    acceptanceCosts,
    productOrders,
    productCards,
    unitCosts,
    warehouseRemains,
    isInitialLoading,
    isHistoryLoading,
    isReady,
    filters,
    globalTaxRate,
    // Actions
    loadAllDataFromDb,
    setFilters,
    updateGlobalTax,
    // Getters
    totalRecordsCount,
    aggregatedReport,
    totalSummary,
  }
})

