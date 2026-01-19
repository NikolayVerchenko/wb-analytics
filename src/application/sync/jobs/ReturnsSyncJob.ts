import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IReturn, WBReportRow } from '../../../types/db'
import { mapToReturn } from './helpers'

export class ReturnsSyncJob implements SyncJob {
  dataset = 'returns' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[ReturnsSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    const dateFrom = `${plan.range.from}T00:00:00.000Z`
    const dateTo = `${plan.range.to}T23:59:59.999Z`

    const allItems: IReturn[] = []
    let lastRrdId: number | undefined = undefined

    while (true) {
      const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', lastRrdId)

      if (pageItems.length === 0) {
        break
      }

      const returnsItems = (pageItems as WBReportRow[])
        .filter(item => item.supplier_oper_name === 'Возврат')
        .map(item => mapToReturn(item))

      allItems.push(...returnsItems)

      const lastItem = pageItems[pageItems.length - 1] as WBReportRow
      lastRrdId = lastItem.rrd_id

      if (pageItems.length < 100000) {
        break
      }
    }

    console.log(`[ReturnsSyncJob] fetch: загружено ${allItems.length} записей возвратов`)
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const returns = items as IReturn[]

    if (returns.length === 0) {
      return { applied: 0 }
    }

    console.log(`[ReturnsSyncJob] apply: начало сохранения ${returns.length} записей возвратов в БД`)
    await db.returns.bulkPut(returns)
    console.log(`[ReturnsSyncJob] apply: сохранено ${returns.length} записей возвратов`)
    return { applied: returns.length }
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
