import type { ProductAggregate, ReportTotals } from '../../types/analytics'
import type { IStorageCost, IAcceptanceCost } from '../../types/db'

/**
 * Service для агрегации итоговых сумм по отфильтрованным данным
 * Отвечает только за вычисление итогов, не содержит логику фильтрации
 */
export class ReportTotalsCalculator {
  /**
   * Вычисляет итоговые суммы по массиву продуктов
   * @param rows Отфильтрованные данные (ProductAggregate[])
   * @param storageCosts Массив затрат на хранение (опционально)
   * @param acceptanceCosts Массив затрат на приемку (опционально)
   * @param dateFrom Дата начала периода (для фильтрации storageCosts/acceptanceCosts)
   * @param dateTo Дата конца периода (для фильтрации storageCosts/acceptanceCosts)
   * @returns Объект ReportTotals с итоговыми суммами
   */
  static calculateTotals(
    rows: ProductAggregate[],
    storageCosts?: IStorageCost[],
    acceptanceCosts?: IAcceptanceCost[],
    dateFrom?: string,
    dateTo?: string
  ): ReportTotals {
    // Если нет данных, возвращаем нули
    if (rows.length === 0) {
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
        totalLogisticsCostPerUnit: 0,
        totalStorageCosts: 0,
        totalAdvCosts: 0,
        totalAdvCostPerUnit: 0,
        totalPenaltiesCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
        totalMarginPercent: 0,
        totalRoiPercent: 0,
        totalPriceAfterNetRevenue: 0,
        totalDrrSales: 0,
        totalDrrOrders: 0,
        totalDrrOrdersForecast: 0,
        totalAcceptanceCosts: 0,
      }
    }

    // 1. Сначала суммируем абсолютные значения через reduce
    const totals = rows.reduce(
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
        acc.totalAdvCosts += product.advCosts
        acc.totalPenaltiesCosts += product.penaltiesCosts
        acc.totalUnitCosts += product.unitCosts
        acc.totalTaxes += product.taxes
        acc.totalProfit += product.profit
        // Примечание: totalStorageCosts суммируется из product.storageCost, но может быть перезаписано ниже
        acc.totalStorageCosts += product.storageCost
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
        totalSppAmount: 0,
        totalTransferAmount: 0,
        totalCommissionAmount: 0,
        totalLogistics: 0,
        totalStorageCosts: 0,
        totalAdvCosts: 0,
        totalPenaltiesCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
        totalMarginPercent: 0,
        totalRoiPercent: 0,
      }
    )

    // Добавляем затраты на хранение и приемку из внешних источников (если переданы)
    if (dateFrom && dateTo && storageCosts) {
      const filteredStorageCosts = storageCosts.filter((storage) => {
        return storage.dt >= dateFrom && storage.dt <= dateTo
      })
      totals.totalStorageCosts = filteredStorageCosts.reduce((sum, storage) => sum + (storage.sc || 0), 0)
    }

    if (dateFrom && dateTo && acceptanceCosts) {
      const filteredAcceptanceCosts = acceptanceCosts.filter((acceptance) => {
        return acceptance.dt >= dateFrom && acceptance.dt <= dateTo
      })
      totals.totalAcceptanceCosts = filteredAcceptanceCosts.reduce((sum, acceptance) => sum + (acceptance.costs || 0), 0)
    } else {
      totals.totalAcceptanceCosts = 0
    }

    // 2. Потом вычисляем проценты как производные от сумм (НЕ суммируем проценты!)
    // Вычисляем процент выкупа
    totals.totalBuyoutPercent = totals.totalDeliveryCount > 0 
      ? (totals.totalNetSalesCount / totals.totalDeliveryCount) * 100 
      : 0

    // Вычисляем процент СПП
    totals.totalSppPercent = totals.totalNetRevenue > 0
      ? (totals.totalSppAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем процент комиссии
    totals.totalCommissionPercent = totals.totalNetRevenue > 0
      ? (totals.totalCommissionAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем ДРР по продажам
    totals.totalDrrSales = totals.totalNetRevenue > 0
      ? (totals.totalAdvCosts / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем ДРР по заказам
    totals.totalDrrOrders = totals.totalOrdersSum > 0
      ? (totals.totalAdvCosts / totals.totalOrdersSum) * 100
      : 0

    // Вычисляем ДРР прогнозный
    const totalPredictedRevenue = totals.totalOrdersSum > 0 && totals.totalBuyoutPercent > 0
      ? totals.totalOrdersSum * (totals.totalBuyoutPercent / 100)
      : 0
    totals.totalDrrOrdersForecast = totalPredictedRevenue > 0
      ? (totals.totalAdvCosts / totalPredictedRevenue) * 100
      : 0

    // Вычисляем маржу % = (Прибыль / Реализация до СПП) * 100
    totals.totalMarginPercent = totals.totalNetRevenue > 0
      ? (totals.totalProfit / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем ROI % = (Прибыль / Себестоимость) * 100
    totals.totalRoiPercent = totals.totalUnitCosts > 0
      ? (totals.totalProfit / totals.totalUnitCosts) * 100
      : 0

    // Вычисляем Цену после реализация до СПП = totalNetRevenue / totalNetSalesCount
    totals.totalPriceAfterNetRevenue = totals.totalNetSalesCount > 0
      ? totals.totalNetRevenue / totals.totalNetSalesCount
      : 0

    // Вычисляем Логистику на ед = totalLogistics / totalNetSalesCount
    totals.totalLogisticsCostPerUnit = totals.totalNetSalesCount > 0
      ? totals.totalLogistics / totals.totalNetSalesCount
      : 0

    // Вычисляем Рекламу на ед = totalAdvCosts / totalNetSalesCount
    totals.totalAdvCostPerUnit = totals.totalNetSalesCount > 0
      ? totals.totalAdvCosts / totals.totalNetSalesCount
      : 0

    return totals as ReportTotals
  }
}