export type TaxSettings = {
  account_id: string
  tax_rate_percent: number | null
  tax_base: string
  effective_from: string | null
  created_at: string | null
  updated_at: string | null
}

export type TaxSettingsUpsert = {
  tax_rate_percent: number
  effective_from?: string | null
}
