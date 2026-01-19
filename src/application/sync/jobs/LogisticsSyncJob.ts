import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { ILogistics, WBReportRow } from '../../../types/db'
import { mapToLogistics } from './helpers'

export class LogisticsSyncJob implements SyncJob {
  dataset = 'logistics' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[LogisticsSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    const dateFrom = `${plan.range.from}T00:00:00.000Z`
    const dateTo = `${plan.range.to}T23:59:59.999Z`

    const allItems: ILogistics[] = []
    let lastRrdId: number | undefined = undefined

    while (true) {
      const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', lastRrdId)

      if (pageItems.length === 0) {
        break
      }

      const logisticsItems = (pageItems as WBReportRow[])
        .filter(item => item.supplier_oper_name === 'Логистика')
        .map(item => mapToLogistics(item))

      allItems.push(...logisticsItems)

      const lastItem = pageItems[pageItems.length - 1] as WBReportRow
      lastRrdId = lastItem.rrd_id

      if (pageItems.length < 100000) {
        break
      }
    }

    console.log(`[LogisticsSyncJob] fetch: загружено ${allItems.length} записей логистики`)
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const logistics = items as ILogistics[]

    if (logistics.length === 0) {
      return { applied: 0 }
    }

    console.log(`[LogisticsSyncJob] apply: начало сохранения ${logistics.length} записей логистики в БД`)
    await db.logistics.bulkPut(logistics)
    console.log(`[LogisticsSyncJob] apply: сохранено ${logistics.length} записей логистики`)
    return { applied: logistics.length }
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
