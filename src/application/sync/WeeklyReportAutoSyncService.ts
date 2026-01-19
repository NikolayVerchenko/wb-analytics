import type { SyncPolicy } from './SyncPolicy'
import type { WbApiClient } from '../../api/WbApiClient'
import { WeeklyReportReadinessService } from './WeeklyReportReadinessService'
import { lastClosedWeekRange } from './date'
import { FinanceReportSyncJob } from './jobs/FinanceReportSyncJob'
import { DbCheckpointRepository } from './DbCheckpointRepository'
import { DbLoadedPeriodRepository } from './DbLoadedPeriodRepository'
import type { SyncContext, SyncPlan } from './SyncJob'
import { db } from '../../db/db'
import type { DatasetKey } from './types'
import type { ISale, IReturn, ILogistics, IPenalty } from '../../types/db'

export type WeeklyAutoSyncState = 'synced' | 'not-ready' | 'already-loaded' | 'error'

export type WeeklyAutoSyncResult = {
  state: WeeklyAutoSyncState
  readiness: {
    ready: boolean
    checkedAt: string
    range: { from: string; to: string }
    reason: string
  }
}

export class WeeklyReportAutoSyncService {
  private readonly stateKey = 'weekly_report_auto_state'

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: SyncPolicy,
    private readonly nowIso: () => string
  ) {}

  async checkAndSync(): Promise<WeeklyAutoSyncResult> {
    const range = lastClosedWeekRange(this.nowIso())
    const checkedAt = new Date().toISOString()

    const readinessService = new WeeklyReportReadinessService(this.apiClient, this.policy, this.nowIso)
    const readiness = await readinessService.checkSalesWeeklyReport()

    if (!readiness.ready) {
      return {
        state: 'not-ready',
        readiness: {
          ready: false,
          checkedAt: readiness.checkedAt,
          range: readiness.range,
          reason: readiness.reason,
        },
      }
    }

    const loadedPeriodRepo = new DbLoadedPeriodRepository()
    const alreadyLoaded = await this.isWeeklyRangeLoaded(loadedPeriodRepo, range)
    if (alreadyLoaded) {
      return {
        state: 'already-loaded',
        readiness: {
          ready: true,
          checkedAt,
          range,
          reason: 'already-loaded',
        },
      }
    }

    try {
      await this.syncFinanceRange(range)
      await this.setLastLoadedTo(range.to)

      return {
        state: 'synced',
        readiness: {
          ready: true,
          checkedAt,
          range,
          reason: 'ready',
        },
      }
    } catch (error) {
      console.error('[WeeklyReportAutoSync] sync failed:', error)
      return {
        state: 'error',
        readiness: {
          ready: false,
          checkedAt,
          range,
          reason: 'error',
        },
      }
    }
  }

  private async syncFinanceRange(range: { from: string; to: string }): Promise<void> {
    const checkpointRepo = new DbCheckpointRepository()
    const loadedPeriodRepo = new DbLoadedPeriodRepository()

    const ctx: SyncContext = {
      checkpointRepo,
      loadedPeriodRepo,
      nowIso: () => new Date().toISOString().split('T')[0],
      apiClient: this.apiClient,
      policy: this.policy,
    }

    const job = new FinanceReportSyncJob(this.apiClient, this.policy.sales)
    const plan: SyncPlan = {
      dataset: 'sales',
      range: { from: range.from, to: range.to },
      mode: 'backfill',
      syncMode: 'weekly',
    }

    const fetched = await job.fetch(ctx, plan)
    const data = (fetched[0] || { sales: [], returns: [], logistics: [], penalties: [] }) as {
      sales: ISale[]
      returns: IReturn[]
      logistics: ILogistics[]
      penalties: IPenalty[]
    }

    await job.apply(ctx, plan, fetched)

    const prev = await checkpointRepo.get('sales')
    const nextCheckpoint = job.buildNextCheckpoint(ctx, plan, prev, fetched.length)
    await checkpointRepo.upsert(nextCheckpoint)

    await this.registerLoadedPeriods(loadedPeriodRepo, range, data)
  }

  private async isWeeklyRangeLoaded(
    loadedPeriodRepo: DbLoadedPeriodRepository,
    range: { from: string; to: string }
  ): Promise<boolean> {
    const periods = await loadedPeriodRepo.getByDataset('sales')
    return periods.some(p => p.pt === 'weekly' && p.fr <= range.from && p.to >= range.to)
  }

  private async registerLoadedPeriods(
    loadedPeriodRepo: DbLoadedPeriodRepository,
    range: { from: string; to: string },
    data: { sales: ISale[]; returns: IReturn[]; logistics: ILogistics[]; penalties: IPenalty[] }
  ): Promise<void> {
    const datasets: Array<{ key: DatasetKey; count: number }> = [
      { key: 'sales', count: data.sales.length },
      { key: 'returns', count: data.returns.length },
      { key: 'logistics', count: data.logistics.length },
      { key: 'penalties', count: data.penalties.length },
    ]

    for (const dataset of datasets) {
      await loadedPeriodRepo.add({
        ds: dataset.key,
        pt: 'weekly',
        fr: range.from,
        to: range.to,
        la: new Date().toISOString(),
        rc: dataset.count,
      })
    }
  }

  private async getLastLoadedTo(): Promise<string | null> {
    const entry = await db.syncRegistry.get(this.stateKey)
    return entry?.value?.lastLoadedTo || null
  }

  private async setLastLoadedTo(to: string): Promise<void> {
    await db.syncRegistry.put({
      key: this.stateKey,
      value: { lastLoadedTo: to },
      updatedAt: Date.now(),
    })
  }
}
