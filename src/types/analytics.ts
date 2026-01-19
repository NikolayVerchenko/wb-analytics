/**
 * Типы для агрегированных данных аналитики
 */

// Базовые метрики заказов
export interface OrderMetrics {
  ordersCount: number
  ordersSum: number
  deliveryCount: number
  cancelCount: number
}

// Финансовые метрики
export interface FinancialMetrics {
  revenue: number // реализация до СПП
  revenueAfterSpp: number // после СПП
  sellerAmount: number
  returnsRevenue: number
  returnsPa: number
  netRevenue: number
  netSalesCount: number
  priceAfterNetRevenue: number // Цена после реализация до СПП = netRevenue / netSalesCount
}

// Метрики СПП и комиссий
export interface SppMetrics {
  sppAmount: number
  sppPercent: number
  salesPz: number
  returnsPz: number
  transferAmount: number
  commissionAmount: number
  commissionPercent: number
}

// Метрики затрат
export interface CostMetrics {
  logisticsCosts: number
  logisticsCostPerUnit: number // Логистика на ед = logisticsCosts / netSalesCount
  storageCost: number
  advCosts: number
  advCostPerUnit: number // Реклама на ед = advCosts / netSalesCount
  penaltiesCosts: number
  unitCosts: number
  taxes: number
  profit: number // Прибыль = Перечисления - Логистика - Хранение - Реклама - Налог - Себестоимость
  marginPercent: number // Маржа % = (Прибыль / Реализация до СПП) * 100
  roiPercent: number // ROI % = (Прибыль / Себестоимость) * 100
}

// Метрики ДРР (реклама)
export interface DrrMetrics {
  drrSales: number
  drrOrders: number
  drrOrdersForecast: number
}

// Информация о продукте
export interface ProductInfo {
  ni: number
  title: string
  img: string
  bc: string
  sa: string
  sj: string
}

// Агрегат размера (композиция интерфейсов)
export interface SizeAggregate extends OrderMetrics, FinancialMetrics, SppMetrics, CostMetrics {
  sz: string
  salesCount: number
  returnsCount: number
  buyoutPercent: number
  // ДРР всегда 0 для размеров
  drrSales: 0
  drrOrders: 0
  drrOrdersForecast: 0
}

// Агрегат продукта (композиция интерфейсов)
export interface ProductAggregate extends ProductInfo, OrderMetrics, FinancialMetrics, SppMetrics, CostMetrics, DrrMetrics {
  sizes: SizeAggregate[]
  stocks: number
  salesCount: number
  returnsCount: number
  buyoutPercent: number
}

// Итоговые суммы для таблицы "Сводка"
export interface ReportTotals {
  totalOrdersCount: number
  totalOrdersSum: number
  totalDeliveryCount: number
  totalCancelCount: number
  totalReturnsCount: number
  totalSalesCount: number
  totalNetSalesCount: number
  totalRevenue: number
  totalNetRevenue: number
  totalRevenueAfterSpp: number
  totalSellerAmount: number
  totalBuyoutPercent: number
  totalSppAmount: number
  totalSppPercent: number
  totalTransferAmount: number
  totalCommissionAmount: number
  totalCommissionPercent: number
  totalLogistics: number
  totalLogisticsCostPerUnit: number // Логистика на ед = totalLogistics / totalNetSalesCount
  totalStorageCosts: number
  totalAdvCosts: number
  totalAdvCostPerUnit: number // Реклама на ед = totalAdvCosts / totalNetSalesCount
  totalPenaltiesCosts: number
  totalUnitCosts: number
  totalTaxes: number
  totalProfit: number
  totalMarginPercent: number // Маржа % = (Прибыль / Реализация до СПП) * 100
  totalRoiPercent: number // ROI % = (Прибыль / Себестоимость) * 100
  totalPriceAfterNetRevenue: number // Цена после реализация до СПП = totalNetRevenue / totalNetSalesCount
  totalDrrSales: number
  totalDrrOrders: number
  totalDrrOrdersForecast: number
  totalAcceptanceCosts: number
}
