import type { EconomicsPeriodItem, EconomicsPeriodSize, EconomicsPeriodTotals } from './types'

export type EconomicsValueKind = 'number' | 'money' | 'percent'
export type EconomicsLeadingColumnKey = 'article'

export interface EconomicsLeadingColumn {
  key: EconomicsLeadingColumnKey
  label: string
}

export interface EconomicsMetricColumn {
  key: string
  label: string
  kind: EconomicsValueKind
  totalsKey: keyof EconomicsPeriodTotals
  itemKey: keyof EconomicsPeriodItem
  sizeKey: keyof EconomicsPeriodSize | null
}

export const ECONOMICS_LEADING_COLUMNS: EconomicsLeadingColumn[] = [
  { key: 'article', label: 'Артикул' },
]

export const ECONOMICS_METRIC_COLUMNS: EconomicsMetricColumn[] = [
  { key: 'sales_quantity', label: 'Продажи, шт', kind: 'number', totalsKey: 'sales_quantity', itemKey: 'sales_quantity', sizeKey: 'sales_quantity' },
  { key: 'delivery_quantity', label: 'Доставки, шт', kind: 'number', totalsKey: 'delivery_quantity', itemKey: 'delivery_quantity', sizeKey: 'delivery_quantity' },
  { key: 'refusal_quantity', label: 'Отказы, шт', kind: 'number', totalsKey: 'refusal_quantity', itemKey: 'refusal_quantity', sizeKey: 'refusal_quantity' },
  { key: 'buyout_percent', label: '% выкупа', kind: 'percent', totalsKey: 'buyout_percent', itemKey: 'buyout_percent', sizeKey: 'buyout_percent' },
  { key: 'realization_before_spp', label: 'Реал. до СПП', kind: 'money', totalsKey: 'realization_before_spp', itemKey: 'realization_before_spp', sizeKey: 'realization_before_spp' },
  { key: 'realization_after_spp', label: 'Реал. после СПП', kind: 'money', totalsKey: 'realization_after_spp', itemKey: 'realization_after_spp', sizeKey: 'realization_after_spp' },
  { key: 'spp_amount', label: 'СПП', kind: 'money', totalsKey: 'spp_amount', itemKey: 'spp_amount', sizeKey: 'spp_amount' },
  { key: 'spp_percent', label: '% СПП', kind: 'percent', totalsKey: 'spp_percent', itemKey: 'spp_percent', sizeKey: 'spp_percent' },
  { key: 'seller_transfer', label: 'Перечислено', kind: 'money', totalsKey: 'seller_transfer', itemKey: 'seller_transfer', sizeKey: 'seller_transfer' },
  { key: 'wb_commission_amount', label: 'Комиссия ВБ', kind: 'money', totalsKey: 'wb_commission_amount', itemKey: 'wb_commission_amount', sizeKey: 'wb_commission_amount' },
  { key: 'wb_commission_percent', label: '% комиссии', kind: 'percent', totalsKey: 'wb_commission_percent', itemKey: 'wb_commission_percent', sizeKey: 'wb_commission_percent' },
  { key: 'delivery_cost', label: 'Логистика', kind: 'money', totalsKey: 'delivery_cost', itemKey: 'delivery_cost', sizeKey: 'delivery_cost' },
  { key: 'paid_storage_cost', label: 'Хранение', kind: 'money', totalsKey: 'paid_storage_cost', itemKey: 'paid_storage_cost', sizeKey: 'paid_storage_cost' },
  { key: 'penalty_cost', label: 'Штрафы', kind: 'money', totalsKey: 'penalty_cost', itemKey: 'penalty_cost', sizeKey: 'penalty_cost' },
  { key: 'acceptance_cost', label: 'Платная приемка', kind: 'money', totalsKey: 'acceptance_cost', itemKey: 'acceptance_cost', sizeKey: null },
  { key: 'tax_amount', label: 'Налог', kind: 'money', totalsKey: 'tax_amount', itemKey: 'tax_amount', sizeKey: 'tax_amount' },
  { key: 'cogs_amount', label: 'Себестоимость', kind: 'money', totalsKey: 'cogs_amount', itemKey: 'cogs_amount', sizeKey: 'cogs_amount' },
  { key: 'advert_cost', label: 'Реклама', kind: 'money', totalsKey: 'advert_cost', itemKey: 'advert_cost', sizeKey: null },
  { key: 'profit_amount', label: 'Прибыль', kind: 'money', totalsKey: 'profit_amount', itemKey: 'profit_amount', sizeKey: 'profit_amount' },
  { key: 'margin_percent', label: '% маржи', kind: 'percent', totalsKey: 'margin_percent', itemKey: 'margin_percent', sizeKey: 'margin_percent' },
  { key: 'roi_percent', label: 'ROI', kind: 'percent', totalsKey: 'roi_percent', itemKey: 'roi_percent', sizeKey: 'roi_percent' },
]
