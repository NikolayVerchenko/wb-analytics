import { apiGet } from './http'
import type {
  EconomicsSizeItem,
  GetPeriodItemsParams,
  GetPeriodSizesParams,
  ItemsResponse,
} from '../types/economics'

export function getPeriodItems(params: GetPeriodItemsParams): Promise<ItemsResponse> {
  return apiGet<ItemsResponse>('/api/economics/period-items', params)
}

export function getPeriodSizes(params: GetPeriodSizesParams): Promise<EconomicsSizeItem[]> {
  return apiGet<EconomicsSizeItem[]>('/api/economics/period-sizes', params)
}
