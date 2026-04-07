import { apiGet } from './http'
import type { StockItemsResponse, StockWarehouse } from '../types/stocks'

export function getStockItems(params: {
  account_id: string
  search?: string
  limit?: number
  offset?: number
}) {
  return apiGet<StockItemsResponse>('/api/stocks/items', params)
}

export function getStockWarehouses(params: {
  account_id: string
  nm_id: number
  vendor_code: string
  tech_size: string
}) {
  return apiGet<StockWarehouse[]>('/api/stocks/warehouses', params)
}
