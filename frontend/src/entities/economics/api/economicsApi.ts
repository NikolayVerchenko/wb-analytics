import { apiGet } from '../../../shared/api/http'
import type { EconomicsPeriodItemsResponse, EconomicsPeriodSize } from '../model/types'

interface EconomicsItemsQuery {
  accountId: string
  dateFrom: string
  dateTo: string
  signal?: AbortSignal
}

interface EconomicsSizesQuery {
  accountId: string
  dateFrom: string
  dateTo: string
  nmId: number
  vendorCode: string
  signal?: AbortSignal
}

export function fetchEconomicsPeriodItems(query: EconomicsItemsQuery): Promise<EconomicsPeriodItemsResponse> {
  const searchParams = new URLSearchParams({
    account_id: query.accountId,
    date_from: query.dateFrom,
    date_to: query.dateTo,
  })

  return apiGet<EconomicsPeriodItemsResponse>(`/economics/period-items?${searchParams.toString()}`, {
    signal: query.signal,
  })
}

export function fetchEconomicsPeriodSizes(query: EconomicsSizesQuery): Promise<EconomicsPeriodSize[]> {
  const searchParams = new URLSearchParams({
    account_id: query.accountId,
    date_from: query.dateFrom,
    date_to: query.dateTo,
    nm_id: String(query.nmId),
    vendor_code: query.vendorCode,
  })

  return apiGet<EconomicsPeriodSize[]>(`/economics/period-sizes?${searchParams.toString()}`, {
    signal: query.signal,
  })
}
