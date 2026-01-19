import type { ProductAggregate, ReportTotals, SizeAggregate } from '../../types/analytics'

/**
 * Типы форматирования для колонок
 */
export type ColumnFormat = 'currency' | 'percent' | 'int' | 'text' | 'buyout-percent' | 'custom'

/**
 * Функция форматирования значения
 */
export type Formatter = (value: number) => string

/**
 * Функция получения CSS класса для ячейки
 */
export type CellClassGetter = (value: number) => string

/**
 * Определение колонки таблицы
 */
export interface ColumnDef<TData, TTotals = TData> {
  /** Уникальный идентификатор колонки (НЕ МЕНЯТЬ без миграции!) */
  id: string
  /** Лейбл колонки для заголовка */
  label: string
  /** Видима по умолчанию */
  defaultVisible: boolean
  /** Рендер ячейки для строки данных */
  cell: (row: TData, index?: number) => string | { text: string; classes?: string }
  /** Рендер ячейки для строки итогов (если не задано, используется cell) */
  totalCell?: (totals: TTotals) => string | { text: string; classes?: string }
  /** Рендер ячейки для размера (если не задано, используется cell, но может вернуть '—') */
  sizeCell?: (size: SizeAggregate) => string | { text: string; classes?: string } | '—'
  /** Ширина колонки (опционально) */
  width?: string
  /** Текст tooltip для заголовка (опционально) */
  headerTooltip?: string
}

/**
 * Форматтеры
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPercent = (value: number): string => {
  return value.toFixed(2) + '%'
}

const formatBuyoutPercent = (value: number): string => {
  return value.toFixed(1) + '%'
}

const formatInt = (value: number): string => {
  return Math.round(value).toString()
}

/**
 * CSS классы для условного форматирования
 */
const getBuyoutPercentClass = (value: number): string => {
  if (value < 30) return 'text-red-600 font-semibold'
  if (value > 70) return 'text-green-600 font-semibold'
  return 'text-gray-700'
}

const getMarginPercentClass = (value: number): string => {
  if (value < 0) return 'text-red-600 font-semibold'
  if (value > 20) return 'text-green-600 font-semibold'
  if (value > 10) return 'text-green-500'
  return 'text-gray-700'
}

const getRoiPercentClass = (value: number): string => {
  if (value < 0) return 'text-red-600 font-semibold'
  if (value > 100) return 'text-green-600 font-semibold'
  if (value > 50) return 'text-green-500'
  if (value > 0) return 'text-gray-700'
  return 'text-gray-500'
}

/**
 * Определения колонок для таблицы Summary
 * ВАЖНО: id колонок НЕ МЕНЯТЬ без миграции настроек!
 */
export const summaryColumns: ColumnDef<ProductAggregate, ReportTotals>[] = [
  // Колонка "Товар" - особая, всегда первая и sticky
  {
    id: 'product',
    label: 'Товар',
    defaultVisible: true,
    width: 'w-20',
    cell: () => '', // Рендерится отдельно в шаблоне
    totalCell: () => 'Итого',
  },
  {
    id: 'orders',
    label: 'Заказы',
    defaultVisible: true,
    cell: (row) => `${row.ordersCount} / ${formatCurrency(row.ordersSum)}`,
    totalCell: (totals) => `${totals.totalOrdersCount} / ${formatCurrency(totals.totalOrdersSum)}`,
    sizeCell: () => '— / —',
  },
  {
    id: 'deliveries',
    label: 'Доставки',
    defaultVisible: true,
    cell: (row) => formatInt(row.deliveryCount),
    totalCell: (totals) => formatInt(totals.totalDeliveryCount),
    sizeCell: (size) => formatInt(size.deliveryCount),
  },
  {
    id: 'cancels',
    label: 'Отказы',
    defaultVisible: true,
    cell: (row) => formatInt(row.cancelCount),
    totalCell: (totals) => formatInt(totals.totalCancelCount),
    sizeCell: (size) => formatInt(size.cancelCount),
  },
  {
    id: 'returns',
    label: 'Возвраты',
    defaultVisible: true,
    cell: (row) => formatInt(row.returnsCount),
    totalCell: (totals) => formatInt(totals.totalReturnsCount),
    sizeCell: (size) => formatInt(size.returnsCount),
  },
  {
    id: 'sales',
    label: 'Продажи (шт.)',
    defaultVisible: true,
    cell: (row) => formatInt(row.salesCount),
    totalCell: (totals) => formatInt(totals.totalSalesCount),
    sizeCell: (size) => formatInt(size.salesCount),
  },
  {
    id: 'netSales',
    label: 'Реализация (шт.)',
    defaultVisible: true,
    cell: (row) => formatInt(row.netSalesCount),
    totalCell: (totals) => formatInt(totals.totalNetSalesCount),
    sizeCell: (size) => formatInt(size.netSalesCount),
  },
  {
    id: 'buyoutPercent',
    label: '% Выкупа',
    defaultVisible: true,
    cell: (row) => ({
      text: formatBuyoutPercent(row.buyoutPercent),
      classes: getBuyoutPercentClass(row.buyoutPercent),
    }),
    totalCell: (totals) => ({
      text: formatBuyoutPercent(totals.totalBuyoutPercent),
      classes: getBuyoutPercentClass(totals.totalBuyoutPercent),
    }),
    sizeCell: (size) => ({
      text: formatBuyoutPercent(size.buyoutPercent),
      classes: getBuyoutPercentClass(size.buyoutPercent),
    }),
  },
  {
    id: 'netRevenue',
    label: 'Реализация до СПП',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.netRevenue),
    totalCell: (totals) => formatCurrency(totals.totalNetRevenue),
    sizeCell: (size) => formatCurrency(size.netRevenue),
  },
  {
    id: 'priceAfterNetRevenue',
    label: 'Цена',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.priceAfterNetRevenue),
    totalCell: (totals) => formatCurrency(totals.totalPriceAfterNetRevenue),
    sizeCell: (size) => formatCurrency(size.priceAfterNetRevenue),
  },
  {
    id: 'revenueAfterSpp',
    label: 'Реализация после СПП',
    defaultVisible: true,
    cell: (row) => ({
      text: formatCurrency(row.revenueAfterSpp),
      classes: row.revenueAfterSpp < 0 ? 'text-red-600' : '',
    }),
    totalCell: (totals) => ({
      text: formatCurrency(totals.totalRevenueAfterSpp),
      classes: totals.totalRevenueAfterSpp < 0 ? 'text-red-600' : '',
    }),
    sizeCell: (size) => ({
      text: formatCurrency(size.revenueAfterSpp),
      classes: size.revenueAfterSpp < 0 ? 'text-red-600' : '',
    }),
  },
  {
    id: 'sppAmount',
    label: 'Сумма СПП',
    defaultVisible: true,
    cell: (row) => ({
      text: formatCurrency(row.sppAmount),
      classes: row.sppAmount < 0 ? 'text-gray-500' : '',
    }),
    totalCell: (totals) => ({
      text: formatCurrency(totals.totalSppAmount),
      classes: totals.totalSppAmount < 0 ? 'text-gray-500' : '',
    }),
    sizeCell: (size) => ({
      text: formatCurrency(size.sppAmount),
      classes: size.sppAmount < 0 ? 'text-gray-500' : '',
    }),
  },
  {
    id: 'sppPercent',
    label: '% СПП',
    defaultVisible: true,
    cell: (row) => formatPercent(row.sppPercent),
    totalCell: (totals) => formatPercent(totals.totalSppPercent),
    sizeCell: (size) => formatPercent(size.sppPercent),
  },
  {
    id: 'transferAmount',
    label: 'Перечисления',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.transferAmount),
    totalCell: (totals) => formatCurrency(totals.totalTransferAmount),
    sizeCell: (size) => formatCurrency(size.transferAmount),
  },
  {
    id: 'commissionAmount',
    label: 'Комиссия WB (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.commissionAmount),
    totalCell: (totals) => formatCurrency(totals.totalCommissionAmount),
    sizeCell: (size) => formatCurrency(size.commissionAmount),
  },
  {
    id: 'commissionPercent',
    label: '% Комиссии',
    defaultVisible: true,
    cell: (row) => formatPercent(row.commissionPercent),
    totalCell: (totals) => formatPercent(totals.totalCommissionPercent),
    sizeCell: (size) => formatPercent(size.commissionPercent),
  },
  {
    id: 'logistics',
    label: 'Логистика (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.logisticsCosts),
    totalCell: (totals) => formatCurrency(totals.totalLogistics),
    sizeCell: (size) => formatCurrency(size.logisticsCosts),
  },
  {
    id: 'logisticsCostPerUnit',
    label: 'Логистика на ед',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.logisticsCostPerUnit),
    totalCell: (totals) => formatCurrency(totals.totalLogisticsCostPerUnit),
    sizeCell: (size) => formatCurrency(size.logisticsCostPerUnit),
  },
  {
    id: 'storage',
    label: 'Хранение (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.storageCost),
    totalCell: (totals) => formatCurrency(totals.totalStorageCosts),
    sizeCell: (size) => formatCurrency(size.storageCost),
  },
  {
    id: 'advCosts',
    label: 'Реклама (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.advCosts),
    totalCell: (totals) => formatCurrency(totals.totalAdvCosts),
    sizeCell: () => '—',
  },
  {
    id: 'advCostPerUnit',
    label: 'Реклама на ед',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.advCostPerUnit),
    totalCell: (totals) => formatCurrency(totals.totalAdvCostPerUnit),
    sizeCell: (size) => formatCurrency(size.advCostPerUnit),
  },
  {
    id: 'drrSales',
    label: 'ДРР (пр.)',
    defaultVisible: true,
    headerTooltip: 'Отношение рекламы к реализации до СПП.',
    cell: (row) => ({
      text: formatPercent(row.drrSales),
      classes: row.drrSales > 20 ? 'text-orange-600' : '',
    }),
    totalCell: (totals) => formatPercent(totals.totalDrrSales),
    sizeCell: () => '—',
  },
  {
    id: 'drrOrders',
    label: 'ДРР (зак.)',
    defaultVisible: true,
    headerTooltip: 'Отношение рекламы к сумме заказов.',
    cell: (row) => formatPercent(row.drrOrders),
    totalCell: (totals) => formatPercent(totals.totalDrrOrders),
    sizeCell: () => '—',
  },
  {
    id: 'drrOrdersForecast',
    label: 'ДРР (прогноз)',
    defaultVisible: true,
    headerTooltip: 'Отношение рекламы к заказам с учетом коэффициента выкупа.',
    cell: (row) => formatPercent(row.drrOrdersForecast),
    totalCell: (totals) => formatPercent(totals.totalDrrOrdersForecast),
    sizeCell: () => '—',
  },
  {
    id: 'taxes',
    label: 'Налог (₽)',
    defaultVisible: true,
    headerTooltip: 'Налог рассчитывается от Реализации после СПП (фактически полученные деньги на счет).',
    cell: (row) => formatCurrency(row.taxes),
    totalCell: (totals) => formatCurrency(totals.totalTaxes),
    sizeCell: (size) => formatCurrency(size.taxes),
  },
  {
    id: 'unitCosts',
    label: 'Себестоимость (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.unitCosts),
    totalCell: (totals) => formatCurrency(totals.totalUnitCosts),
    sizeCell: (size) => formatCurrency(size.unitCosts),
  },
  {
    id: 'unitCostPerItem',
    label: 'Себестоимость на единицу (₽)',
    defaultVisible: true,
    cell: (row) => formatCurrency(row.netSalesCount > 0 ? row.unitCosts / row.netSalesCount : 0),
    totalCell: (totals) => formatCurrency(totals.totalNetSalesCount > 0 ? totals.totalUnitCosts / totals.totalNetSalesCount : 0),
    sizeCell: (size) => formatCurrency(size.netSalesCount > 0 ? size.unitCosts / size.netSalesCount : 0),
  },
  {
    id: 'profit',
    label: 'Прибыль (₽)',
    defaultVisible: true,
    cell: (row) => ({
      text: formatCurrency(row.profit),
      classes: row.profit < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold',
    }),
    totalCell: (totals) => ({
      text: formatCurrency(totals.totalProfit),
      classes: totals.totalProfit < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold',
    }),
    sizeCell: (size) => ({
      text: formatCurrency(size.profit),
      classes: size.profit < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold',
    }),
  },
  {
    id: 'marginPercent',
    label: 'Маржа %',
    defaultVisible: true,
    cell: (row) => ({
      text: formatPercent(row.marginPercent),
      classes: getMarginPercentClass(row.marginPercent),
    }),
    totalCell: (totals) => ({
      text: formatPercent(totals.totalMarginPercent),
      classes: getMarginPercentClass(totals.totalMarginPercent),
    }),
    sizeCell: (size) => ({
      text: formatPercent(size.marginPercent),
      classes: getMarginPercentClass(size.marginPercent),
    }),
  },
  {
    id: 'roiPercent',
    label: 'ROI %',
    defaultVisible: true,
    cell: (row) => ({
      text: formatPercent(row.roiPercent),
      classes: getRoiPercentClass(row.roiPercent),
    }),
    totalCell: (totals) => ({
      text: formatPercent(totals.totalRoiPercent),
      classes: getRoiPercentClass(totals.totalRoiPercent),
    }),
    sizeCell: (size) => ({
      text: formatPercent(size.roiPercent),
      classes: getRoiPercentClass(size.roiPercent),
    }),
  },
]
