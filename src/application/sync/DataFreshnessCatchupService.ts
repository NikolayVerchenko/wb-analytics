import type { SyncContext } from './SyncJob'
import type { DatasetKey } from './types'
import type { SyncPolicy } from './SyncPolicy'
import type { MissingRange } from './DataFreshnessService'
import { DataFreshnessService } from './DataFreshnessService'
import { buildSyncRangesForWindow } from './calendar'
import { WeekSyncCoordinator } from './WeekSyncCoordinator'
import type { WbApiClient } from '../../api/WbApiClient'

export type FreshnessCatchupPlan = {
  missingRanges: MissingRange[]
  rangeFrom: string | null
  rangeTo: string | null
}

export class DataFreshnessCatchupService {
  constructor(
    private readonly ctx: SyncContext,
    private readonly apiClient: WbApiClient,
    private readonly policy: SyncPolicy,
    private readonly datasets: DatasetKey[]
  ) {}

  async plan(): Promise<FreshnessCatchupPlan> {
    const freshness = new DataFreshnessService(this.ctx.loadedPeriodRepo, this.policy, this.ctx.nowIso)
    const missingRanges = await freshness.getMissingRanges(this.datasets)
    const missingFroms = missingRanges.map(item => item.missingFrom).filter(Boolean) as string[]
    const missingTos = missingRanges.map(item => item.missingTo).filter(Boolean) as string[]

    if (missingFroms.length === 0 || missingTos.length === 0) {
      return { missingRanges, rangeFrom: null, rangeTo: null }
    }

    const rangeFrom = missingFroms.reduce((min, val) => (val < min ? val : min), missingFroms[0])
    const rangeTo = missingTos.reduce((max, val) => (val > max ? val : max), missingTos[0])

    if (rangeFrom > rangeTo) {
      return { missingRanges, rangeFrom: null, rangeTo: null }
    }

    return { missingRanges, rangeFrom, rangeTo }
  }

  async run(onProgress?: (current: number, total: number, rangeLabel: string) => void): Promise<FreshnessCatchupPlan> {
    const plan = await this.plan()
    if (!plan.rangeFrom || !plan.rangeTo) {
      return plan
    }

    const ranges = buildSyncRangesForWindow(plan.rangeFrom, plan.rangeTo)
    if (ranges.length === 0) {
      return plan
    }

    const coordinator = new WeekSyncCoordinator(this.ctx, this.apiClient, this.policy, this.datasets)
    await coordinator.runRanges(ranges, onProgress, { useResume: false })

    return plan
  }
}
