import type { DatasetKey, Checkpoint } from './types'
import type { SyncPlan } from './SyncJob'
import type { SyncContext } from './SyncJob'
import type { DatasetPolicy } from './SyncPolicy'
import { buildCatchupPlan, buildPriorityPlan, buildRefreshPlan, buildSalesBackfillPlan } from './planning'

export type PlanMode = 'priority' | 'catchup' | 'refresh' | 'backfill'

export const planForMode = async (
  ctx: SyncContext,
  dataset: DatasetKey,
  checkpoint: Checkpoint | null,
  policy: DatasetPolicy,
  mode: PlanMode
): Promise<SyncPlan | null> => {
  const nowIso = ctx.nowIso()

  if (mode === 'priority') {
    return buildPriorityPlan({ dataset, policy, nowIso, checkpoint })
  }

  if (mode === 'refresh') {
    return buildRefreshPlan({ dataset, policy, nowIso, checkpoint })
  }

  if (mode === 'backfill') {
    // Backfill поддерживается только для sales
    if (dataset === 'sales') {
      const today = new Date(nowIso)
      return buildSalesBackfillPlan(policy, checkpoint, today)
    }
    // Для других datasets backfill не поддерживается
    return null
  }

  // catchup
  return buildCatchupPlan({ dataset, policy, nowIso, checkpoint })
}
