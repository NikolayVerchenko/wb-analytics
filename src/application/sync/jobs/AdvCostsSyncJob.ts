import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IAdvCost } from '../../../types/db'

export class AdvCostsSyncJob implements SyncJob {
  dataset = 'advCosts' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[AdvCostsSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    // getAdvHistory возвращает массив объектов с полями: date, sum/updSum, advertId, updTime
    const advData = await this.apiClient.getAdvHistory(plan.range.from, plan.range.to)
    const advSum = advData.reduce((sum, item) => sum + (item.sum ?? item.updSum ?? 0), 0)
    console.log(`[AdvCostsSyncJob] fetch: advHistory items=${advData.length}, sum=${advSum.toFixed(2)}`)
    if (advData.length > 0) {
      console.log(`[AdvCostsSyncJob] fetch: advHistory sample:`, advData.slice(0, 3))
    }

    if (advData.length === 0) {
      console.log(`[AdvCostsSyncJob] fetch: нет данных рекламных расходов`)
      return []
    }

    // Собираем уникальные advertId
    const advertIds = [...new Set(advData.map(item => item.advertId).filter(Boolean))] as number[]
    
    if (advertIds.length === 0) {
      console.log(`[AdvCostsSyncJob] fetch: нет advertId в данных`)
      return []
    }

    // Получаем информацию о кампаниях для получения nmIds
    // API ограничивает до 50 ID за запрос, разбиваем на батчи
    const batchSize = 50
    const batches: number[][] = []
    for (let i = 0; i < advertIds.length; i += batchSize) {
      batches.push(advertIds.slice(i, i + batchSize))
    }

    const advertInfoMap = new Map<number, number[]>() // advertId -> nmIds[]

    for (const batch of batches) {
      const campaignsInfo = await this.apiClient.getAdvInfo(batch)
      console.log(`[AdvCostsSyncJob] fetch: advInfo batch size=${batch.length}, campaigns=${campaignsInfo.length}`)
      
      for (const campaign of campaignsInfo) {
        if (campaign.id && campaign.nm_settings) {
          const nmIds: number[] = []
          for (const nmSetting of campaign.nm_settings) {
            if (nmSetting.nm_id) {
              nmIds.push(nmSetting.nm_id)
            }
          }
          if (nmIds.length > 0) {
            advertInfoMap.set(campaign.id, nmIds)
          }
        }
      }
    }

    // Распределяем затраты по артикулам
    const costsMap = new Map<string, IAdvCost>()

    for (const item of advData) {
      if (!item.advertId) continue

      const nmIds = advertInfoMap.get(item.advertId)
      if (!nmIds || nmIds.length === 0) continue

      const date = item.date ? new Date(item.date).toISOString().split('T')[0] : plan.range.from
      const itemSum = item.sum ?? item.updSum ?? 0
      const sumPerProduct = itemSum / nmIds.length

      for (const nmId of nmIds) {
        const pk = `${nmId}_${date}`
        const existing = costsMap.get(pk)
        
        if (existing) {
          existing.costs += sumPerProduct
        } else {
          costsMap.set(pk, {
            pk,
            dt: date,
            ni: nmId,
            costs: sumPerProduct,
          })
        }
      }
    }

    const allItems = Array.from(costsMap.values())
    const mappedSum = allItems.reduce((sum, item) => sum + (item.costs || 0), 0)
    console.log(`[AdvCostsSyncJob] fetch: загружено ${allItems.length} записей рекламных расходов, mappedSum=${mappedSum.toFixed(2)}`)
    if (allItems.length > 0) {
      console.log(`[AdvCostsSyncJob] fetch: mapped sample:`, allItems.slice(0, 3))
    }
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const advCosts = items as IAdvCost[]

    if (advCosts.length === 0) {
      return { applied: 0 }
    }

    const savedSum = advCosts.reduce((sum, item) => sum + (item.costs || 0), 0)
    console.log(`[AdvCostsSyncJob] apply: начало сохранения ${advCosts.length} записей рекламных расходов в БД`)
    await db.adv_costs.bulkPut(advCosts)
    console.log(`[AdvCostsSyncJob] apply: сохранено ${advCosts.length} записей рекламных расходов, sum=${savedSum.toFixed(2)}`)
    return { applied: advCosts.length }
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
