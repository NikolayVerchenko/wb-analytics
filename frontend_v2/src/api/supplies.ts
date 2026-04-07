import { apiGet, apiPut } from './http'
import type { Supply, SupplyArticleCostUpsert, SupplyItem, SupplyItemCostUpsert } from '../types/supplies'

export function getSupplies(params: { account_id: string }) {
  return apiGet<Supply[]>('/api/supplies', params)
}

export function getSupplyItems(supplyId: number, params: { account_id: string }) {
  return apiGet<SupplyItem[]>(`/api/supplies/${supplyId}/items`, params)
}

export function putSupplyItemCost(supplyId: number, accountId: string, payload: SupplyItemCostUpsert) {
  return apiPut<void, SupplyItemCostUpsert>(`/api/supplies/${supplyId}/items/cost?account_id=${accountId}`, payload)
}

export function putSupplyArticleCostForAllSizes(supplyId: number, accountId: string, payload: SupplyArticleCostUpsert) {
  return apiPut<void, SupplyArticleCostUpsert>(`/api/supplies/${supplyId}/items/cost/all-sizes?account_id=${accountId}`, payload)
}
