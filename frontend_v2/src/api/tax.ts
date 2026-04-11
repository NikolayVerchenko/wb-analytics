import { apiGet, apiPut } from './http'
import type { TaxSettings, TaxSettingsUpsert } from '../types/tax'

export function getTaxSettings(accountId: string) {
  return apiGet<TaxSettings>(`/api/tax-settings/${accountId}`)
}

export function putTaxSettings(accountId: string, payload: TaxSettingsUpsert) {
  return apiPut<TaxSettings, TaxSettingsUpsert>(`/api/tax-settings/${accountId}`, payload)
}
