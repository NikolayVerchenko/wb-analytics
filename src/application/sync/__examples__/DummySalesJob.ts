import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import { defaultHighWatermark, addDays } from '../date'

export const DummySalesJob: SyncJob = {
  dataset: 'sales',

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    const high = defaultHighWatermark(ctx.nowIso())

    const from = checkpoint?.cursorTime ?? addDays(high, -30)
    if (from > high) return null

    return {
      dataset: 'sales',
      mode: 'catchup',
      range: { from, to: high },
    }
  },

  async fetch(): Promise<unknown[]> {
    return [{ id: 1 }, { id: 2 }]
  },

  async apply(_ctx, _plan, items): Promise<{ applied: number }> {
    return { applied: items.length }
  },

  buildNextCheckpoint(ctx, plan, _prev, _fetched): Checkpoint {
    return {
      dataset: plan.dataset,
      cursorTime: plan.range.to,
      highWatermarkTime: plan.range.to,
      updatedAt: ctx.nowIso(),
    }
  },
}
