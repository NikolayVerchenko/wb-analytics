import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IAcceptanceCost } from '../../../types/db'

export class AcceptanceCostsSyncJob implements SyncJob {
  dataset = 'acceptanceCosts' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[AcceptanceCostsSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    // Создаём задачу на генерацию отчета
    const taskId = await this.apiClient.createAcceptanceTask(plan.range.from, plan.range.to)
    
    // Ждём готовности отчета (повторяем до "done", 429 не прерывает ожидание)
    const checkInterval = 2000 // 2 секунды
    const retryInterval = 10000 // 10 секунд при 429

    while (true) {
      try {
        const status = await this.apiClient.getAcceptanceStatus(taskId)

        if (status === 'done') {
          break
        }

        if (status === 'canceled' || status === 'purged') {
          throw new Error(`Задача генерации отчета о приёмке была отменена или удалена (status: ${status})`)
        }
      } catch (error: any) {
        const isRateLimited = error?.status === 429 || error?.response?.status === 429
        if (isRateLimited) {
          console.log('[AcceptanceCostsSyncJob] Лимит запросов при проверке статуса. Повтор через 10 секунд...')
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue
        }
        throw error
      }

      // Ждём перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    // Загружаем отчет
    const reportData = await this.apiClient.downloadAcceptanceReport(taskId)
    
    // Преобразуем данные API в формат IAcceptanceCost
    const allItems: IAcceptanceCost[] = []
    
    for (const item of reportData) {
      const shkCreateDate = item.shkCreateDate || item.shk_create_date || item.date || plan.range.from
      const date = new Date(shkCreateDate).toISOString().split('T')[0]
      const nmID = item.nmID || item.nm_id || 0
      const pk = `${nmID}_${date}`
      
      allItems.push({
        pk,
        dt: date,
        ni: nmID,
        costs: item.cost || item.acceptanceCost || 0,
      })
    }

    console.log(`[AcceptanceCostsSyncJob] fetch: загружено ${allItems.length} записей расходов на приёмку`)
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const acceptanceCosts = items as IAcceptanceCost[]

    if (acceptanceCosts.length === 0) {
      return { applied: 0 }
    }

    console.log(`[AcceptanceCostsSyncJob] apply: начало сохранения ${acceptanceCosts.length} записей расходов на приёмку в БД`)
    await db.acceptance_costs.bulkPut(acceptanceCosts)
    console.log(`[AcceptanceCostsSyncJob] apply: сохранено ${acceptanceCosts.length} записей расходов на приёмку`)
    return { applied: acceptanceCosts.length }
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
