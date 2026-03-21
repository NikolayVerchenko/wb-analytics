export interface EconomicsPeriodTotals {
  sales_quantity: string | null
  delivery_quantity: string | null
  refusal_quantity: string | null
  buyout_percent: string | null
  realization_before_spp: string | null
  realization_after_spp: string | null
  spp_amount: string | null
  spp_percent: string | null
  seller_transfer: string | null
  wb_commission_amount: string | null
  wb_commission_percent: string | null
  advert_cost: string | null
  delivery_cost: string | null
  paid_storage_cost: string | null
  penalty_cost: string | null
  acceptance_cost: string | null
  tax_amount: string | null
  cogs_amount: string | null
  profit_amount: string | null
  margin_percent: string | null
  roi_percent: string | null
}

export interface EconomicsPeriodItem {
  source_mode: 'closed' | 'current' | 'mixed' | string
  account_id: string
  date_from: string
  date_to: string
  week_start: string | null
  nm_id: number
  vendor_code: string | null
  brand_name: string | null
  subject_name: string | null
  bonus_type_name: string | null
  account_name: string | null
  photo_url: string | null
  sales_quantity: number | null
  return_quantity: number | null
  retail_price_sale: string | null
  retail_price_return: string | null
  realization_before_spp: string | null
  retail_amount_sale: string | null
  retail_amount_return: string | null
  realization_after_spp: string | null
  spp_amount: string | null
  spp_percent: string | null
  ppvz_for_pay_sale: string | null
  ppvz_for_pay_return: string | null
  seller_transfer: string | null
  delivery_quantity: string | null
  refusal_quantity: string | null
  buyout_percent: string | null
  delivery_cost: string | null
  penalty_cost: string | null
  cashback_amount: string | null
  paid_storage_cost: string | null
  advert_cost: string | null
  acceptance_cost: string | null
  wb_commission_amount: string | null
  wb_commission_percent: string | null
  tax_amount: string | null
  cogs_amount: string | null
  profit_amount: string | null
  margin_percent: string | null
  roi_percent: string | null
}

export interface EconomicsPeriodSize {
  source_mode: 'closed' | 'current' | 'mixed' | string
  account_id: string
  date_from: string
  date_to: string
  week_start: string | null
  nm_id: number
  vendor_code: string | null
  ts_name: string | null
  brand_name: string | null
  subject_name: string | null
  bonus_type_name: string | null
  account_name: string | null
  photo_url: string | null
  sales_quantity: number | null
  return_quantity: number | null
  retail_price_sale: string | null
  retail_price_return: string | null
  realization_before_spp: string | null
  retail_amount_sale: string | null
  retail_amount_return: string | null
  realization_after_spp: string | null
  spp_amount: string | null
  spp_percent: string | null
  ppvz_for_pay_sale: string | null
  ppvz_for_pay_return: string | null
  seller_transfer: string | null
  delivery_quantity: string | null
  refusal_quantity: string | null
  buyout_percent: string | null
  delivery_cost: string | null
  penalty_cost: string | null
  cashback_amount: string | null
  paid_storage_cost: string | null
  tax_amount: string | null
  cogs_amount: string | null
  wb_commission_amount: string | null
  wb_commission_percent: string | null
  profit_amount: string | null
  margin_percent: string | null
  roi_percent: string | null
}

export interface EconomicsPeriodItemsResponse {
  items: EconomicsPeriodItem[]
  totals: EconomicsPeriodTotals
}
