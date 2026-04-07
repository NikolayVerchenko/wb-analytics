import { apiGet } from './http'
import type { DashboardResponse, GetDashboardParams } from '../types/dashboard'

export function getEconomicsDashboard(params: GetDashboardParams): Promise<DashboardResponse> {
  return apiGet<DashboardResponse>('/api/economics/dashboard', params)
}
