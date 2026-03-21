import { apiGet, apiPut } from '../../../shared/api/http'
import type { TaxSettings, TaxSettingsUpsert } from '../model/types'

export function fetchTaxSettings(accountId: string): Promise<TaxSettings> {
  return apiGet<TaxSettings>(`/tax-settings/${accountId}`)
}

export function saveTaxSettings(accountId: string, payload: TaxSettingsUpsert): Promise<TaxSettings> {
  return apiPut<TaxSettings, TaxSettingsUpsert>(`/tax-settings/${accountId}`, payload)
}
