export interface TaxSettings {
  account_id: string
  tax_rate_percent: string
  tax_base: string
  effective_from: string
  created_at: string
  updated_at: string
}

export interface TaxSettingsUpsert {
  tax_rate_percent: number
  effective_from?: string | null
}
