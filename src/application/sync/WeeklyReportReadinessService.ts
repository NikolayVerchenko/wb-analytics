import type { SyncPolicy } from './SyncPolicy'
import { lastClosedWeekRange } from './date'
import type { WbApiClient } from '../../api/WbApiClient'

export type WeeklyReportReadiness = {
  ready: boolean
  checkedAt: string
  range: { from: string; to: string }
  reason: 'ready' | 'no-data' | 'before-lower-bound' | 'error'
}

export class WeeklyReportReadinessService {
  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: SyncPolicy,
    private readonly nowIso: () => string
  ) {}

  async checkSalesWeeklyReport(): Promise<WeeklyReportReadiness> {
    const checkedAt = new Date().toISOString()
    const range = lastClosedWeekRange(this.nowIso())
    const lowerBound = this.policy.sales.backfillLowerBound || '2024-01-29'

    if (range.to < lowerBound) {
      return {
        ready: false,
        checkedAt,
        range,
        reason: 'before-lower-bound',
      }
    }

    try {
      const dateFrom = `${range.from}T00:00:00.000Z`
      const dateTo = `${range.to}T23:59:59.999Z`
      const items = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', 0)
      return {
        ready: items.length > 0,
        checkedAt,
        range,
        reason: items.length > 0 ? 'ready' : 'no-data',
      }
    } catch (error) {
      console.error('[WeeklyReportReadiness] check failed:', error)
      return {
        ready: false,
        checkedAt,
        range,
        reason: 'error',
      }
    }
  }
}
