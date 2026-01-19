import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { ISupply, ISupplyItem } from '../../../types/db'

/**
 * SuppliesSyncJob - загрузка поставок
 * 
 * ВАЖНО: Supplies используют другой API (supplies-api.wildberries.ru), 
 * который требует отдельного клиента (WBApiClient из infrastructure/api/wbApiClient.ts).
 * 
 * Для упрощения, этот job использует упрощенную логику:
 * - Загружает список поставок через существующий SupplyService (если доступен)
 * - Или возвращает пустой массив, если SupplyService не доступен
 * 
 * TODO: Интегрировать с WBApiClient для полноценной загрузки поставок
 */
export class SuppliesSyncJob implements SyncJob {
  dataset = 'supplies' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    // Supplies загружаются по-другому (не через стандартный catchup)
    // Возвращаем null, чтобы не загружать через стандартный механизм
    // TODO: Реализовать специальную логику для supplies
    return null
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    // Supplies требуют специальной логики через SupplyService
    // Пока возвращаем пустой массив
    console.log(`[SuppliesSyncJob] fetch: supplies требуют специальной логики через SupplyService (пока не реализовано)`)
    return []
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const supplies = items as ISupply[]

    if (supplies.length === 0) {
      return { applied: 0 }
    }

    console.log(`[SuppliesSyncJob] apply: начало сохранения ${supplies.length} поставок в БД`)
    await db.supplies.bulkPut(supplies)
    console.log(`[SuppliesSyncJob] apply: сохранено ${supplies.length} поставок`)
    return { applied: supplies.length }
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
