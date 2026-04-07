import type { Supply, SupplyItem } from './types'
import { formatDate } from '../../../shared/lib/formatters'

export type SupplyListColumnKey =
  | 'supply_id'
  | 'supply_date'
  | 'fact_date'
  | 'status_id'
  | 'items_count'
  | 'planned_quantity'
  | 'accepted_quantity_total'

export type SupplyItemColumnKey =
  | 'article'
  | 'tech_size'
  | 'color'
  | 'barcode'
  | 'quantity'
  | 'accepted_quantity'
  | 'unit_cogs'

export interface SupplyListColumn {
  key: SupplyListColumnKey
  label: string
}

export interface SupplyItemColumn {
  key: SupplyItemColumnKey
  label: string
}

export const SUPPLY_LIST_COLUMNS: SupplyListColumn[] = [
  { key: 'supply_id', label: 'Поставка' },
  { key: 'supply_date', label: 'Дата поставки' },
  { key: 'fact_date', label: 'Факт' },
  { key: 'status_id', label: 'Статус' },
  { key: 'items_count', label: 'Позиций' },
  { key: 'planned_quantity', label: 'План, шт' },
  { key: 'accepted_quantity_total', label: 'Принято, шт' },
]

export const SUPPLY_ITEM_COLUMNS: SupplyItemColumn[] = [
  { key: 'article', label: 'Артикул' },
  { key: 'tech_size', label: 'Размер' },
  { key: 'color', label: 'Цвет' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'quantity', label: 'Количество' },
  { key: 'accepted_quantity', label: 'Принято' },
  { key: 'unit_cogs', label: 'Себестоимость' },
]

export function formatSupplyListCell(item: Supply, key: SupplyListColumnKey): string | number {
  switch (key) {
    case 'supply_id': return item.supply_id
    case 'supply_date': return formatDate(item.supply_date)
    case 'fact_date': return formatDate(item.fact_date)
    case 'status_id': return item.status_id ?? '—'
    case 'items_count': return item.items_count
    case 'planned_quantity': return item.planned_quantity
    case 'accepted_quantity_total': return item.accepted_quantity_total
  }
}

export function formatSupplyItemCell(item: SupplyItem, key: SupplyItemColumnKey): string | number {
  switch (key) {
    case 'tech_size': return item.tech_size || '—'
    case 'color': return item.color || '—'
    case 'barcode': return item.barcode || '—'
    case 'quantity': return item.quantity ?? 0
    case 'accepted_quantity': return item.accepted_quantity ?? 0
    case 'article':
    case 'unit_cogs':
      return '—'
  }
}
