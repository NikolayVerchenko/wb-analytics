import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IPenalty, WBReportRow } from '../../../types/db'
import { mapToPenalty } from './helpers'

export class PenaltiesSyncJob implements SyncJob {
  dataset = 'penalties' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[PenaltiesSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    const dateFrom = `${plan.range.from}T00:00:00.000Z`
    const dateTo = `${plan.range.to}T23:59:59.999Z`

    const allItems: IPenalty[] = []
    let lastRrdId: number | undefined = undefined

    while (true) {
      const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', lastRrdId)

      if (pageItems.length === 0) {
        break
      }

      const penaltiesItems = (pageItems as WBReportRow[])
        .filter(item => item.penalty && item.penalty !== 0)
        .map(item => mapToPenalty(item))

      allItems.push(...penaltiesItems)

      const lastItem = pageItems[pageItems.length - 1] as WBReportRow
      lastRrdId = lastItem.rrd_id

      if (pageItems.length < 100000) {
        break
      }
    }

    console.log(`[PenaltiesSyncJob] fetch: загружено ${allItems.length} записей штрафов`)
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const penalties = items as IPenalty[]

    if (penalties.length === 0) {
      return { applied: 0 }
    }

    console.log(`[PenaltiesSyncJob] apply: начало сохранения ${penalties.length} записей штрафов в БД`)
    await db.penalties.bulkPut(penalties)
    console.log(`[PenaltiesSyncJob] apply: сохранено ${penalties.length} записей штрафов`)
    return { applied: penalties.length }
  }

  buildNextCheckpoint(ctx: SyncContext, plan: SyncPlan, _prev: Checkpoint | null, _fetched: number): Checkpoint {
    const high = defaultHighWatermark(ctx.nowIso())
    
    return {
      dataset: this.dataset,
      cursorTime: plan.range.to,
      highWatermarkTime: high,
      updatedAt: ctx.nowIso(),
    }
  }
}
