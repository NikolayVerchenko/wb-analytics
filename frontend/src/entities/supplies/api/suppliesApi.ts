import { apiGet, apiPut } from '../../../shared/api/http'
import type { Supply, SupplyArticleCostUpsert, SupplyItem, SupplyItemCostUpsert } from '../model/types'

interface RequestOptions {
  signal?: AbortSignal
}

export function fetchSupplies(accountId: string, options: RequestOptions = {}): Promise<Supply[]> {
  const searchParams = new URLSearchParams({
    account_id: accountId,
  })

  return apiGet<Supply[]>(`/supplies?${searchParams.toString()}`, options)
}

export function fetchSupplyItems(accountId: string, supplyId: number, options: RequestOptions = {}): Promise<SupplyItem[]> {
  const searchParams = new URLSearchParams({
    account_id: accountId,
  })

  return apiGet<SupplyItem[]>(`/supplies/${supplyId}/items?${searchParams.toString()}`, options)
}

export function saveSupplyItemCost(accountId: string, supplyId: number, payload: SupplyItemCostUpsert): Promise<void> {
  const searchParams = new URLSearchParams({
    account_id: accountId,
  })

  return apiPut<void, SupplyItemCostUpsert>(`/supplies/${supplyId}/items/cost?${searchParams.toString()}`, payload)
}

export function saveSupplyArticleCostForAllSizes(
  accountId: string,
  supplyId: number,
  payload: SupplyArticleCostUpsert,
): Promise<void> {
  const searchParams = new URLSearchParams({
    account_id: accountId,
  })

  return apiPut<void, SupplyArticleCostUpsert>(
    `/supplies/${supplyId}/items/cost/all-sizes?${searchParams.toString()}`,
    payload,
  )
}
