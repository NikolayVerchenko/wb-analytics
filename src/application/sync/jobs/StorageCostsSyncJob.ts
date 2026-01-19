import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IStorageCost } from '../../../types/db'

export class StorageCostsSyncJob implements SyncJob {
  dataset = 'storageCosts' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[StorageCostsSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    // Проверяем, что период не слишком старый (API не поддерживает периоды старше ~1 года)
    const today = new Date(ctx.nowIso())
    const fromDate = new Date(plan.range.from)
    const daysDiff = Math.floor((today.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > 365) {
      console.warn(`[StorageCostsSyncJob] Период слишком старый (${daysDiff} дней назад), пропускаем загрузку`)
      return []
    }

    try {
      // Создаём задачу на генерацию отчета
      const taskId = await this.apiClient.createStorageTask(plan.range.from, plan.range.to)
      
      // Ждём готовности отчета (проверяем статус каждые 2 секунды, максимум 5 минут)
      const maxWaitTime = 5 * 60 * 1000 // 5 минут
      const checkInterval = 2000 // 2 секунды
      const startTime = Date.now()
      
      while (Date.now() - startTime < maxWaitTime) {
        const status = await this.apiClient.getStorageStatus(taskId)
        
        if (status === 'done') {
          break
        }
        
        if (status === 'canceled' || status === 'purged') {
          throw new Error(`Задача генерации отчета о хранении была отменена или удалена (status: ${status})`)
        }
        
        // Ждём перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
      
      // Загружаем отчет
      const reportData = await this.apiClient.downloadStorageReport(taskId)
    
      // Преобразуем данные API в формат IStorageCost
      const allItems: IStorageCost[] = []
      
      for (const item of reportData) {
        const date = item.date ? new Date(item.date).toISOString().split('T')[0] : plan.range.from
        const nmId = item.nmId || item.nm_id || 0
        const size = item.size || item.techSize || ''
        const pk = `${date}_${nmId}_${size}`
        
        allItems.push({
          pk,
          dt: date,
          sj: item.subjectName || item.subject_name || '',
          bc: item.brandName || item.brand_name || '',
          sa: item.vendorCode || item.vendor_code || '',
          ni: nmId,
          sz: size,
          sc: item.cost || item.storageCost || 0,
        })
      }

      console.log(`[StorageCostsSyncJob] fetch: загружено ${allItems.length} записей расходов на хранение`)
      return allItems
    } catch (error: any) {
      // Обрабатываем ошибки API (400, 429 и т.д.)
      if (error?.response?.status === 400) {
        console.warn(`[StorageCostsSyncJob] API вернул 400 для периода ${plan.range.from} - ${plan.range.to}, возможно период слишком старый или некорректный`)
        return []
      }
      if (error?.response?.status === 429) {
        console.warn(`[StorageCostsSyncJob] API вернул 429 (лимит запросов) для периода ${plan.range.from} - ${plan.range.to}`)
        throw error // Пробрасываем 429, чтобы система могла повторить позже
      }
      // Для других ошибок тоже пробрасываем
      throw error
    }
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const storageCosts = items as IStorageCost[]

    if (storageCosts.length === 0) {
      return { applied: 0 }
    }

    console.log(`[StorageCostsSyncJob] apply: начало сохранения ${storageCosts.length} записей расходов на хранение в БД`)
    await db.storage_costs.bulkPut(storageCosts)
    console.log(`[StorageCostsSyncJob] apply: сохранено ${storageCosts.length} записей расходов на хранение`)
    return { applied: storageCosts.length }
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
