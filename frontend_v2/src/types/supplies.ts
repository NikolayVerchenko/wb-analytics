export type Supply = {
  account_id: string
  supply_id: number
  preorder_id?: number | null
  status_id?: number | null
  create_date?: string | null
  supply_date?: string | null
  fact_date?: string | null
  updated_date?: string | null
  items_count: number
  planned_quantity: number
  accepted_quantity_total: number
}

export type SupplyItem = {
  account_id: string
  supply_id: number
  preorder_id?: number | null
  supply_target_id: number
  is_preorder_id: boolean
  status_id?: number | null
  create_date?: string | null
  supply_date?: string | null
  fact_date?: string | null
  updated_date?: string | null
  nm_id: number
  vendor_code: string
  tech_size?: string | null
  barcode?: string | null
  color?: string | null
  need_kiz?: boolean | null
  tnved?: string | null
  supplier_box_amount?: number | null
  quantity?: number | null
  ready_for_sale_quantity?: number | null
  unloading_quantity?: number | null
  accepted_quantity?: number | null
  photo_url?: string | null
  unit_cogs?: number | null
}

export type SupplyItemCostUpsert = {
  nm_id: number
  vendor_code: string
  tech_size?: string | null
  barcode?: string | null
  unit_cogs: number
}

export type SupplyArticleCostUpsert = {
  nm_id: number
  vendor_code: string
  unit_cogs: number
}
