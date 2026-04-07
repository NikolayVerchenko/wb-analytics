export type StockItem = {
  account_id: string
  nm_id: number
  vendor_code: string | null
  tech_size: string | null
  brand_name?: string | null
  subject_name?: string | null
  photo_url?: string | null
  snapshot_loaded_at?: string | null
  total_on_warehouses?: number | null
  in_transit_to_customer?: number | null
  in_transit_from_customer?: number | null
  total_stock?: number | null
  cogs_per_unit?: number | null
  stock_cogs_total?: number | null
}

export type StockTotals = {
  snapshot_loaded_at?: string | null
  total_on_warehouses?: number | null
  in_transit_to_customer?: number | null
  in_transit_from_customer?: number | null
  total_stock?: number | null
  cogs_per_unit?: number | null
  stock_cogs_total?: number | null
}

export type StockItemsResponse = {
  items: StockItem[]
  totals: StockTotals | null
}

export type StockWarehouse = {
  warehouse_name: string
  snapshot_loaded_at?: string | null
  quantity?: number | null
}
