export type EconomicsItem = {
  photo_url?: string | null
  vendor_code: string | null
  nm_id: number | null
  delivery_quantity?: number | null
  sales_quantity: number | null
  seller_transfer: number | null
  cogs_amount: number | null
  profit_amount: number | null
  margin_percent: number | null
  roi_percent: number | null
}

export type EconomicsSizeItem = {
  ts_name?: string | null
  delivery_quantity?: number | null
  sales_quantity: number | null
  seller_transfer: number | null
  cogs_amount: number | null
  profit_amount: number | null
  margin_percent: number | null
  roi_percent: number | null
}

export type EconomicsTotals = {
  sales_quantity?: number | null
  seller_transfer?: number | null
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
}

export type GetPeriodSizesParams = {
  account_id: string
  date_from: string
  date_to: string
  nm_id: number
  vendor_code: string
}
