import { apiGet } from './http'
import type { EconomicsFilterOptions, GetEconomicsFilterOptionsParams } from '../types/filters'

export function getEconomicsFilterOptions(
  params: GetEconomicsFilterOptionsParams,
): Promise<EconomicsFilterOptions> {
  return apiGet<EconomicsFilterOptions>('/api/economics/filter-options', params)
}
