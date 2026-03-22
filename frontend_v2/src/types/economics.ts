export type EconomicsItem = {
  photo_url?: string | null
  vendor_code: string | null
  nm_id: number | null
  delivery_quantity?: number | null
  refusal_quantity?: number | null
  sales_quantity: number | null
  buyout_percent?: number | null
  realization_before_spp?: number | null
  spp_amount?: number | null
  spp_percent?: number | null
  seller_transfer: number | null
  wb_commission_amount?: number | null
  wb_commission_percent?: number | null
  delivery_cost?: number | null
  paid_storage_cost?: number | null
  acceptance_cost?: number | null
  penalty_cost?: number | null
  advert_cost?: number | null
  tax_amount?: number | null
  cogs_amount: number | null
  profit_amount: number | null
  margin_percent: number | null
  roi_percent: number | null
}

export type EconomicsSizeItem = {
  ts_name?: string | null
  delivery_quantity?: number | null
  refusal_quantity?: number | null
  sales_quantity: number | null
  buyout_percent?: number | null
  realization_before_spp?: number | null
  spp_amount?: number | null
  spp_percent?: number | null
  seller_transfer: number | null
  wb_commission_amount?: number | null
  wb_commission_percent?: number | null
  delivery_cost?: number | null
  paid_storage_cost?: number | null
  acceptance_cost?: number | null
  penalty_cost?: number | null
  advert_cost?: number | null
  tax_amount?: number | null
  cogs_amount: number | null
  profit_amount: number | null
  margin_percent: number | null
  roi_percent: number | null
}

export type EconomicsTotals = {
  delivery_quantity?: number | null
  refusal_quantity?: number | null
  sales_quantity?: number | null
  buyout_percent?: number | null
  realization_before_spp?: number | null
  spp_amount?: number | null
  spp_percent?: number | null
  seller_transfer?: number | null
  wb_commission_amount?: number | null
  wb_commission_percent?: number | null
  delivery_cost?: number | null
  paid_storage_cost?: number | null
  acceptance_cost?: number | null
  penalty_cost?: number | null
  advert_cost?: number | null
  tax_amount?: number | null
  cogs_amount?: number | null
  profit_amount?: number | null
  margin_percent?: number | null
  roi_percent?: number | null
}

export type ItemsResponse = {
  items: EconomicsItem[]
  totals?: EconomicsTotals | null
}

export type GetPeriodItemsParams = {
  account_id: string
  date_from: string
  date_to: string
  subjects?: string[]
  brands?: string[]
  articles?: string[]
}

export type GetPeriodSizesParams = {
  account_id: string
  date_from: string
  date_to: string
  nm_id: number
  vendor_code: string
}
