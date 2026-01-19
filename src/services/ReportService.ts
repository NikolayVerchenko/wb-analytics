import type {
  ISale,
  IReturn,
  ILogistics,
  IPenalty,
  IStorageCost,
  IProductOrder,
  IAdvCost,
  IProductCard,
  IUnitCost,
  IWarehouseRemain,
  ISupply,
} from '../types/db'
import { CostMatchingService } from '../application/services/cost/CostMatchingService'
import { makeSaleKey } from '../application/services/cost/costKey'
import type { SaleCostMatch } from '../application/services/cost/types'
import type { SizeAggregate, ProductAggregate } from '../types/analytics'

/**
 * Сервис для агрегации данных и формирования отчетов
 */
export class ReportService {
  /**
   * Агрегирует данные за выбранный период
   * @param params Параметры для агрегации
   * @returns Массив агрегированных продуктов
   */
  static aggregate(params: {
    dateFrom: string
    dateTo: string
    sales: ISale[]
    returns: IReturn[]
    logistics: ILogistics[]
    penalties: IPenalty[]
    storageCosts: IStorageCost[]
    productOrders: IProductOrder[]
    advCosts: IAdvCost[]
    productCards: IProductCard[]
    unitCosts: IUnitCost[]
    warehouseRemains: IWarehouseRemain[]
    supplies: ISupply[]
    globalTaxRate: number
  }): ProductAggregate[] {
    const {
      dateFrom,
      dateTo,
      sales,
      returns,
      logistics,
      penalties,
      storageCosts,
      productOrders,
      advCosts,
      productCards,
      unitCosts,
      warehouseRemains,
      supplies,
      globalTaxRate,
    } = params

    // Фильтруем данные по периоду
    const filteredSales = sales.filter(sale => sale.dt >= dateFrom && sale.dt <= dateTo)
    const filteredReturns = returns.filter(ret => ret.dt >= dateFrom && ret.dt <= dateTo)
    const filteredOrders = productOrders.filter(order => order.dt >= dateFrom && order.dt <= dateTo)
    const filteredLogistics = logistics.filter(log => log.dt >= dateFrom && log.dt <= dateTo)
    
    // Отладочная информация для заказов
    if (productOrders.length > 0) {
      console.log(`[ReportService] productOrders: всего=${productOrders.length}, отфильтровано=${filteredOrders.length}, период=${dateFrom} - ${dateTo}`)
      if (filteredOrders.length === 0 && productOrders.length > 0) {
        const sampleDates = [...new Set(productOrders.slice(0, 10).map(o => o.dt))].join(', ')
        console.log(`[ReportService] ⚠️ Заказы не попали в фильтр. Примеры дат заказов: ${sampleDates}`)
      }
    }
    const filteredAdvCosts = advCosts.filter(adv => adv.dt >= dateFrom && adv.dt <= dateTo)
    const filteredPenalties = penalties.filter(penalty => penalty.dt >= dateFrom && penalty.dt <= dateTo)
    const filteredStorageCosts = storageCosts.filter(storage => storage.dt >= dateFrom && storage.dt <= dateTo)

    if (advCosts.length > 0) {
      console.log(`[ReportService] advCosts: всего=${advCosts.length}, отфильтровано=${filteredAdvCosts.length}, период=${dateFrom} - ${dateTo}`)
      if (filteredAdvCosts.length === 0) {
        const sampleDates = [...new Set(advCosts.slice(0, 10).map((a) => a.dt))].join(', ')
        console.log(`[ReportService] ?? Реклама не попала в фильтр. Примеры дат: ${sampleDates}`)
      } else {
        const sample = filteredAdvCosts.slice(0, 5).map((a) => ({ dt: a.dt, ni: a.ni, costs: a.costs }))
        console.log(`[ReportService] Реклама (примеры):`, sample)
        const advSum = filteredAdvCosts.reduce((sum, item) => sum + (Number(item.costs) || 0), 0)
        console.log(`[ReportService] advCosts sum: ${advSum.toFixed(2)}`)
      }
    }

    if (logistics.length > 0) {
      console.log(`[ReportService] logistics: всего=${logistics.length}, отфильтровано=${filteredLogistics.length}, период=${dateFrom} - ${dateTo}`)
      if (filteredLogistics.length === 0) {
        const sampleDates = [...new Set(logistics.slice(0, 10).map(l => l.dt))].join(', ')
        console.log(`[ReportService] ?? Логистика не попала в фильтр. Примеры дат: ${sampleDates}`)
      } else {
        const sample = filteredLogistics.slice(0, 5).map(l => ({ dt: l.dt, dl: l.dl, rt: l.rt, ni: l.ni }))
        console.log(`[ReportService] Логистика (примеры):`, sample)
        const totals = filteredLogistics.reduce(
          (acc, item) => {
            acc.dl += item.dl || 0
            acc.rt += item.rt || 0
            return acc
          },
          { dl: 0, rt: 0 }
        )
        console.log(`[ReportService] Логистика (суммы за период): deliveries=${totals.dl}, returns=${totals.rt}`)
      }
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
          priceAfterNetRevenue: 0,
          buyoutPercent: 0,
          sppAmount: 0,
          sppPercent: 0,
          salesPz: 0,
          returnsPz: 0,
          transferAmount: 0,
          commissionAmount: 0,
          commissionPercent: 0,
          logisticsCosts: 0,
          logisticsCostPerUnit: 0,
          storageCost: 0,
          advCosts: 0,
          advCostPerUnit: 0,
          penaltiesCosts: 0,
          drrSales: 0,
          drrOrders: 0,
          drrOrdersForecast: 0,
          unitCosts: 0,
          taxes: 0,
          profit: 0,
          marginPercent: 0,
          roiPercent: 0,
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
          priceAfterNetRevenue: 0,
          buyoutPercent: 0,
          sppAmount: 0,
          sppPercent: 0,
          salesPz: 0,
          returnsPz: 0,
          transferAmount: 0,
          commissionAmount: 0,
          commissionPercent: 0,
          advCosts: 0,
          advCostPerUnit: 0,
          logisticsCosts: 0,
          logisticsCostPerUnit: 0,
          storageCost: 0,
          drrSales: 0,
          drrOrders: 0,
          drrOrdersForecast: 0,
          penaltiesCosts: 0,
          unitCosts: 0,
          taxes: 0,
          profit: 0,
          marginPercent: 0,
          roiPercent: 0,
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
      product.cancelCount += log.rt || 0 // return_amount - количество отказов

      // Если есть размер, агрегируем по размеру
      if (log.sz) {
        const size = getOrCreateSize(log.ni, log.sz)
        size.logisticsCosts += logisticsCost
        size.deliveryCount += deliveryAmount // суммируем количество доставок
        size.cancelCount += log.rt || 0 // return_amount - количество отказов
      }
    }

    // Агрегируем заказы (product_orders) - только на уровне артикула (нет размера в product_orders)
    let totalOrdersCount = 0
    let totalOrdersSum = 0
    const ordersByNi = new Map<number, { count: number; sum: number }>()
    for (const order of filteredOrders) {
      const product = getOrCreateProduct(order.ni, order.bc, undefined, order.sj)
      const orderCount = order.oc || 0
      const orderSum = order.os || 0
      product.ordersCount += orderCount
      product.ordersSum += orderSum
      totalOrdersCount += orderCount
      totalOrdersSum += orderSum
      
      // Собираем статистику по артикулам
      if (!ordersByNi.has(order.ni)) {
        ordersByNi.set(order.ni, { count: 0, sum: 0 })
      }
      const stats = ordersByNi.get(order.ni)!
      stats.count += orderCount
      stats.sum += orderSum
    }
    if (filteredOrders.length > 0) {
      console.log(`[ReportService] Агрегация заказов: обработано записей=${filteredOrders.length}, totalOrdersCount=${totalOrdersCount}, totalOrdersSum=${totalOrdersSum}`)
      if (totalOrdersCount === 0 && totalOrdersSum === 0) {
        console.warn(`[ReportService] ⚠️ Все заказы имеют orderCount=0 и orderSum=0! Примеры:`, filteredOrders.slice(0, 3).map(o => ({ ni: o.ni, oc: o.oc, os: o.os, dt: o.dt })))
      } else {
        console.log(`[ReportService] Заказы по артикулам:`, Array.from(ordersByNi.entries()).slice(0, 5).map(([ni, stats]) => `nmID=${ni}: count=${stats.count}, sum=${stats.sum}`).join(', '))
      }
    }

    // Агрегируем рекламу (adv_costs) - только на уровне артикула
    let advApplied = 0
    let advSkipped = 0
    for (const adv of filteredAdvCosts) {
      const nmId = typeof adv.ni === 'string' ? Number(adv.ni) : adv.ni
      const cost = Number(adv.costs)
      if (!Number.isFinite(nmId) || !Number.isFinite(cost)) {
        advSkipped += 1
        continue
      }
      const product = getOrCreateProduct(nmId)
      product.advCosts += cost
      advApplied += 1
    }
    if (filteredAdvCosts.length > 0) {
      console.log(`[ReportService] advCosts applied: applied=${advApplied}, skipped=${advSkipped}`)
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
    for (const remain of warehouseRemains) {
      const product = getOrCreateProduct(remain.ni, remain.bc, remain.sa, remain.sj)
      product.stocks += remain.q_wh || 0
    }

    // Считаем себестоимость и налоги для каждого размера и артикула
    const unitCostsMap = new Map<number, { cost: number; taxRate: number }>()
    for (const unitCost of unitCosts) {
      unitCostsMap.set(unitCost.ni, {
        cost: unitCost.cost,
        taxRate: unitCost.taxRate || 0,
      })
    }

    // Сопоставляем себестоимость продаж с поставками через CostMatchingService
    const matcher = CostMatchingService.fromSupplies(supplies, { buildApprox: false })
    const { matches, stats } = matcher.matchSales(filteredSales, { mode: 'STRICT' })

    // Создаем Map для быстрого поиска по saleKey (универсально)
    const costMatchByKey = new Map<string, SaleCostMatch>()
    for (const match of matches) {
      // Используем saleKey для lookup (надежнее чем pk)
      costMatchByKey.set(match.saleKey, match)
      // Если есть pk - тоже добавляем для обратной совместимости
      if (match.pk) {
        costMatchByKey.set(match.pk, match)
      }
    }

    // Логирование статистики (один раз, не на каждую продажу)
    console.log(`[ReportService] Статистика сопоставления себестоимости:`, {
      total: stats.totalSales,
      matched: stats.matched,
      byReason: stats.byReason,
    })

    // Соединяем с productCards для получения фото и названия
    const productCardsMap = new Map<number, IProductCard>()
    for (const card of productCards) {
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
      const taxRate = unitCostData?.taxRate || globalTaxRate

      // Собираем размеры для этого артикула и фильтруем только активные
      const productSizes: SizeAggregate[] = []

      // Создаем Map для расчета средней себестоимости по размерам
      const sizeCostMap = new Map<string, { totalCost: number; totalQuantity: number }>()

      // Проходим по продажам и считаем себестоимость для каждого размера через gi_id
      // Используем результат сопоставления из CostMatchingService
      // Детальное логирование для отладки разных себестоимостей по размерам
      const debugCostDetails = new Map<string, Array<{
        sz: string
        dt: string
        gi_id?: number
        qt: number
        costPerUnit: number
        reason: string
        matchedSupplyId?: number
      }>>()

      for (const sale of filteredSales) {
        if (sale.ni === ni && sale.sz) {
          const sizeKey = `${ni}_${sale.sz}`
          const quantity = sale.qt || 0 // Количество для текущей продажи

          // Получаем себестоимость из результата сопоставления
          const saleKey = makeSaleKey(sale.ni, sale.dt, sale.sz)
          const match = costMatchByKey.get(saleKey) || costMatchByKey.get(sale.pk) || null
          const saleCost = match?.costPerUnit || 0

          // Собираем детали для логирования (только для товаров с себестоимостью)
          if (saleCost > 0) {
            if (!debugCostDetails.has(sale.sz)) {
              debugCostDetails.set(sale.sz, [])
            }
            debugCostDetails.get(sale.sz)!.push({
              sz: sale.sz,
              dt: sale.dt,
              gi_id: sale.gi_id,
              qt: quantity,
              costPerUnit: saleCost,
              reason: match?.reason || 'UNKNOWN',
              matchedSupplyId: match?.matchedSupplyId,
            })
          }

          // Учитываем в расчете средней себестоимости только продажи с себестоимостью
          if (saleCost > 0 && quantity > 0) {
            const existing = sizeCostMap.get(sizeKey)
            if (existing) {
              existing.totalCost += saleCost * quantity
              existing.totalQuantity += quantity
            } else {
              sizeCostMap.set(sizeKey, {
                totalCost: saleCost * quantity,
                totalQuantity: quantity,
              })
            }
          }
        }
      }

      // Логируем детали себестоимости по размерам (если есть различия)
      if (debugCostDetails.size > 1) {
        const uniqueCostsPerSize = new Map<string, Set<number>>()
        for (const [sz, details] of debugCostDetails.entries()) {
          const costs = new Set(details.map(d => d.costPerUnit))
          uniqueCostsPerSize.set(sz, costs)
        }
        
        // Проверяем, есть ли разные себестоимости для разных размеров
        const allCosts = Array.from(debugCostDetails.values())
          .flatMap(details => details.map(d => d.costPerUnit))
        const uniqueCosts = new Set(allCosts)
        
        if (uniqueCosts.size > 1) {
          console.warn(
            `[ReportService] ⚠️ ВНИМАНИЕ: Для nmID=${ni} обнаружены РАЗНЫЕ себестоимости по размерам!`
          )
          for (const [sz, details] of debugCostDetails.entries()) {
            const costs = uniqueCostsPerSize.get(sz)!
            const avgCost = details.reduce((sum, d) => sum + d.costPerUnit * d.qt, 0) / 
                           details.reduce((sum, d) => sum + d.qt, 0)
            console.warn(
              `  Размер ${sz}: средняя себестоимость=${avgCost.toFixed(2)} ₽, ` +
              `уникальные себестоимости=[${Array.from(costs).map(c => c.toFixed(2)).join(', ')}], ` +
              `продаж=${details.length}, поставок gi_id=[${[...new Set(details.map(d => d.gi_id))].join(', ')}]`
            )
            
            // Детализация по каждой продаже (первые 5)
            for (const detail of details.slice(0, 5)) {
              console.warn(
                `    • ${detail.dt}: gi_id=${detail.gi_id}, qt=${detail.qt}, ` +
                `cost=${detail.costPerUnit.toFixed(2)} ₽, reason=${detail.reason}, ` +
                `matchedSupplyId=${detail.matchedSupplyId}`
              )
            }
            if (details.length > 5) {
              console.warn(`    ... и еще ${details.length - 5} продаж`)
            }
          }
        }
      }

      for (const [key, size] of sizesMap.entries()) {
        if (key.startsWith(`${ni}_`)) {
          // ВАЖНО: Вычисляем netSalesCount ПЕРЕД расчетом себестоимости, чтобы использовать его в логировании
          size.netSalesCount = size.salesCount - size.returnsCount
          
          // Рассчитываем среднюю себестоимость для размера (только из поставок)
          const costData = sizeCostMap.get(key)
          let avgUnitCost = 0
          if (costData && costData.totalQuantity > 0) {
            avgUnitCost = costData.totalCost / costData.totalQuantity
            // ВАЖНО: size.unitCosts - это общая себестоимость ТОЛЬКО для чистых продаж (без возвратов)
            // Если есть возвраты (netSalesCount < totalQuantity), то пересчитываем себестоимость только для чистых продаж
            // Это необходимо, чтобы отображение "себестоимость на единицу" (unitCosts / netSalesCount) давало правильную среднюю себестоимость
            if (size.netSalesCount < costData.totalQuantity) {
              // Есть возвраты: пересчитываем себестоимость только для чистых продаж
              size.unitCosts = avgUnitCost * size.netSalesCount
            } else {
              // Нет возвратов: используем полную себестоимость всех продаж с себестоимостью
              size.unitCosts = costData.totalCost
            }
          } else {
            // Если нет себестоимости, то себестоимость = 0
            size.unitCosts = 0
          }
          
          // Логируем после вычисления
          if (costData && costData.totalQuantity > 0) {
            // Вычисляем "себестоимость на единицу" так, как она будет отображаться в UI
            const displayedUnitCost = size.netSalesCount > 0 ? size.unitCosts / size.netSalesCount : 0
            
            console.log(
              `[ReportService] Расчет средней себестоимости для размера: nmID=${ni}, размер=${size.sz}, ` +
              `продано всего=${size.salesCount}, с себестоимостью=${costData.totalQuantity}, ` +
              `средняя себестоимость из поставок=${avgUnitCost.toFixed(2)} ₽, ` +
              `общая себестоимость=${size.unitCosts.toFixed(2)} ₽, ` +
              `чистые продажи (netSalesCount)=${size.netSalesCount}, ` +
              `отображаемая себестоимость на единицу (unitCosts/netSalesCount)=${displayedUnitCost.toFixed(2)} ₽`
            )
            
            // Предупреждение, если отображаемая себестоимость отличается от средней из поставок
            // Это может произойти по двум причинам:
            // 1. Не все продажи имеют себестоимость (costData.totalQuantity < size.salesCount)
            // 2. Есть возвраты, которые влияют на расчет (size.netSalesCount < size.salesCount)
            const hasReturns = size.netSalesCount < size.salesCount
            const hasMissingCost = costData.totalQuantity < size.salesCount
            if (Math.abs(displayedUnitCost - avgUnitCost) > 0.01 && (hasReturns || hasMissingCost)) {
              const reasons: string[] = []
              if (hasReturns) {
                reasons.push(`есть возвраты (${size.salesCount - size.netSalesCount} из ${size.salesCount})`)
              }
              if (hasMissingCost) {
                reasons.push(`не все продажи имеют себестоимость (${costData.totalQuantity} из ${size.salesCount})`)
              }
              console.warn(
                `[ReportService] ⚠️ Для nmID=${ni}, размер=${size.sz}: ` +
                `отображаемая себестоимость (${displayedUnitCost.toFixed(2)} ₽) ` +
                `отличается от средней из поставок (${avgUnitCost.toFixed(2)} ₽), ` +
                `т.к. ${reasons.join(', ')} (чистые продажи=${size.netSalesCount}, с себестоимостью=${costData.totalQuantity})`
              )
            }
          } else {
            console.log(
              `[ReportService] Нет себестоимости для размера: nmID=${ni}, размер=${size.sz}, ` +
              `продано=${size.salesCount}, себестоимость=0 ₽ (нет данных в поставках)`
            )
          }

          // Вычисляем остальные чистые показатели (netSalesCount уже вычислен выше)
          size.netRevenue = size.revenue - size.returnsRevenue // Реализация до СПП
          // Реализация после СПП = retail_amount продаж - retail_amount возвратов
          size.revenueAfterSpp = size.revenueAfterSpp - size.returnsPa
          size.sellerAmount = size.revenueAfterSpp // к перечислению = реализации после СПП
          // Цена после реализация до СПП = netRevenue / netSalesCount
          size.priceAfterNetRevenue = size.netSalesCount > 0 ? size.netRevenue / size.netSalesCount : 0
          // Логистика на ед = logisticsCosts / netSalesCount
          size.logisticsCostPerUnit = size.netSalesCount > 0 ? size.logisticsCosts / size.netSalesCount : 0
          // Реклама на ед = advCosts / netSalesCount
          size.advCostPerUnit = size.netSalesCount > 0 ? size.advCosts / size.netSalesCount : 0

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
          // Прибыль = Перечисления - Логистика - Хранение - Реклама - Налог - Себестоимость
          size.profit = size.transferAmount - size.logisticsCosts - size.storageCost - size.advCosts - size.taxes - size.unitCosts
          // Маржа % = (Прибыль / Реализация до СПП) * 100
          size.marginPercent = size.netRevenue > 0 ? (size.profit / size.netRevenue) * 100 : 0
          // ROI % = (Прибыль / Себестоимость) * 100
          size.roiPercent = size.unitCosts > 0 ? (size.profit / size.unitCosts) * 100 : 0

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
      // Цена после реализация до СПП = netRevenue / netSalesCount
      product.priceAfterNetRevenue = product.netSalesCount > 0 ? product.netRevenue / product.netSalesCount : 0
      // Логистика на ед = logisticsCosts / netSalesCount
      product.logisticsCostPerUnit = product.netSalesCount > 0 ? product.logisticsCosts / product.netSalesCount : 0
      // Реклама на ед = advCosts / netSalesCount
      product.advCostPerUnit = product.netSalesCount > 0 ? product.advCosts / product.netSalesCount : 0
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

      // Рассчитываем среднюю себестоимость для продукта (суммируем из размеров, только из поставок)
      // Используем sizeCostMap напрямую, чтобы учесть только продажи с себестоимостью
      let totalProductCost = 0
      let totalProductQuantityWithCost = 0
      for (const [key, costData] of sizeCostMap.entries()) {
        if (key.startsWith(`${ni}_`)) {
          totalProductCost += costData.totalCost
          totalProductQuantityWithCost += costData.totalQuantity
        }
      }
      // Средняя себестоимость = общая себестоимость / количество продаж с себестоимостью
      const avgProductCost = totalProductQuantityWithCost > 0 ? totalProductCost / totalProductQuantityWithCost : 0
      // ВАЖНО: product.unitCosts - это общая себестоимость ТОЛЬКО для чистых продаж (без возвратов)
      // Если есть возвраты (netSalesCount < totalQuantityWithCost), то пересчитываем себестоимость только для чистых продаж
      // Это необходимо, чтобы отображение "себестоимость на единицу" (unitCosts / netSalesCount) давало правильную среднюю себестоимость
      // ВАЖНО: product.netSalesCount уже вычислен выше (строка 557) как product.salesCount - product.returnsCount
      if (product.netSalesCount < totalProductQuantityWithCost) {
        // Есть возвраты: пересчитываем себестоимость только для чистых продаж
        product.unitCosts = avgProductCost * product.netSalesCount
      } else {
        // Нет возвратов: используем полную себестоимость всех продаж с себестоимостью
        product.unitCosts = totalProductCost
      }
      
      // Вычисляем "себестоимость на единицу" так, как она будет отображаться в UI
      const displayedProductUnitCost = product.netSalesCount > 0 ? product.unitCosts / product.netSalesCount : 0
      
      console.log(
        `[ReportService] Итоговая себестоимость для товара: nmID=${ni}, ` +
        `продано всего=${product.salesCount}, продано с себестоимостью=${totalProductQuantityWithCost}, ` +
        `средняя себестоимость из поставок=${avgProductCost.toFixed(2)} ₽, ` +
        `общая себестоимость=${product.unitCosts.toFixed(2)} ₽, ` +
        `чистые продажи (netSalesCount)=${product.netSalesCount}, ` +
        `отображаемая себестоимость на единицу (unitCosts/netSalesCount)=${displayedProductUnitCost.toFixed(2)} ₽, ` +
        `размеров=${productSizes.length} (только из поставок)`
      )
      
      // Предупреждение, если отображаемая себестоимость отличается от средней из поставок
      const hasReturns = product.netSalesCount < product.salesCount
      const hasMissingCost = totalProductQuantityWithCost < product.salesCount
      if (Math.abs(displayedProductUnitCost - avgProductCost) > 0.01 && (hasReturns || hasMissingCost)) {
        const reasons: string[] = []
        if (hasReturns) {
          reasons.push(`есть возвраты (${product.salesCount - product.netSalesCount} из ${product.salesCount})`)
        }
        if (hasMissingCost) {
          reasons.push(`не все продажи имеют себестоимость (${totalProductQuantityWithCost} из ${product.salesCount})`)
        }
        console.warn(
          `[ReportService] ⚠️ Для nmID=${ni}: ` +
          `отображаемая себестоимость (${displayedProductUnitCost.toFixed(2)} ₽) ` +
          `отличается от средней из поставок (${avgProductCost.toFixed(2)} ₽), ` +
          `т.к. ${reasons.join(', ')} (чистые продажи=${product.netSalesCount}, с себестоимостью=${totalProductQuantityWithCost})`
        )
      }

      // Считаем налоги для продукта (от реализации после СПП)
      product.taxes = product.revenueAfterSpp * (taxRate / 100)
      // Прибыль = Перечисления - Логистика - Хранение - Реклама - Налог - Себестоимость
      product.profit = product.transferAmount - product.logisticsCosts - product.storageCost - product.advCosts - product.taxes - product.unitCosts
      // Маржа % = (Прибыль / Реализация до СПП) * 100
      product.marginPercent = product.netRevenue > 0 ? (product.profit / product.netRevenue) * 100 : 0
      // ROI % = (Прибыль / Себестоимость) * 100
      product.roiPercent = product.unitCosts > 0 ? (product.profit / product.unitCosts) * 100 : 0
    }

    // Фильтруем товары: оставляем только те, где есть активность
    // Активность = хотя бы один из показателей > 0
    const filteredProducts = Array.from(productsMap.values()).filter(product => {
      return (
        product.ordersCount > 0 ||
        product.salesCount > 0 ||
        product.deliveryCount > 0 ||
        product.revenue > 0 ||
        product.advCosts > 0
      )
    })

    if (filteredProducts.length > 0) {
      const advTotals = filteredProducts.reduce(
        (acc, product) => {
          const advCost = Number(product.advCosts)
          if (Number.isFinite(advCost) && advCost > 0) {
            acc.productsWithAdv += 1
            acc.advSum += advCost
          }
          return acc
        },
        { productsWithAdv: 0, advSum: 0 }
      )
      console.log(
        `[ReportService] advCosts totals: products_with_adv=${advTotals.productsWithAdv}, adv_sum=${advTotals.advSum.toFixed(2)}`
      )
    }

    return filteredProducts
  }
}
