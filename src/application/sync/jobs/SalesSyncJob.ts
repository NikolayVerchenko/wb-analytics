import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { ISale, WBReportRow } from '../../../types/db'
import { mapToSale } from './helpers'

/**
 * SyncJob для синхронизации продаж (sales)
 * Поддерживает два режима:
 * - daily: ежедневная загрузка с пагинацией
 * - weekly: еженедельная загрузка закрытой недели
 */
export class SalesSyncJob implements SyncJob {
  dataset = 'sales' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    // Use standard planning for sales (calendar-aware logic is in orchestrator)
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    const syncMode = plan.syncMode || 'daily'
    console.log(`[SalesSyncJob] fetch: начало загрузки ${plan.dataset} (${syncMode}) за период ${plan.range.from} - ${plan.range.to}`)

    // Конвертируем даты в RFC3339 формат для API
    const dateFrom = `${plan.range.from}T00:00:00.000Z`
    const dateTo = `${plan.range.to}T23:59:59.999Z`

    const allItems: ISale[] = []

    if (syncMode === 'weekly') {
      // Weekly режим: загрузка недели одним запросом
      // TODO: replace with real weekly report endpoint if available
      // Пока используем fetchReportPage с period='weekly'
      let lastRrdId: number | undefined = undefined

      while (true) {
        const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', lastRrdId)

        if (pageItems.length === 0) {
          break
        }

        const salesItems = (pageItems as WBReportRow[])
          .filter(item => item.supplier_oper_name === 'Продажа')
          .map(item => mapToSale(item))

        allItems.push(...salesItems)

        const lastItem = pageItems[pageItems.length - 1] as WBReportRow
        lastRrdId = lastItem.rrd_id

        if (pageItems.length < 100000) {
          break
        }
      }
    } else {
      // Daily режим: загрузка с пагинацией (как было)
      let lastRrdId: number | undefined = undefined

      while (true) {
        const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, 'weekly', lastRrdId)

        if (pageItems.length === 0) {
          break
        }

        const salesItems = (pageItems as WBReportRow[])
          .filter(item => item.supplier_oper_name === 'Продажа')
          .map(item => mapToSale(item))

        allItems.push(...salesItems)

        const lastItem = pageItems[pageItems.length - 1] as WBReportRow
        lastRrdId = lastItem.rrd_id

        if (pageItems.length < 100000) {
          break
        }
      }
    }

    console.log(`[SalesSyncJob] fetch: загружено ${allItems.length} записей продаж (${syncMode})`)

    // Группируем записи по pk и суммируем числовые поля
    // Это необходимо, так как API может вернуть несколько транзакций с одинаковым pk
    // (одинаковый nm_id + dt + ts_name), и мы должны суммировать их количество и суммы
    const salesMap = new Map<string, ISale>()

    for (const sale of allItems) {
      const existing = salesMap.get(sale.pk)
      if (existing) {
        // Суммируем числовые поля для записей с одинаковым pk
        existing.qt = (existing.qt || 0) + (sale.qt || 0)
        existing.pv = (existing.pv || 0) + (sale.pv || 0)
        existing.pa = (existing.pa || 0) + (sale.pa || 0)
        existing.pz = (existing.pz || 0) + (sale.pz || 0)
      } else {
        salesMap.set(sale.pk, sale)
      }
    }

    const groupedItems = Array.from(salesMap.values())
    console.log(`[SalesSyncJob] fetch: после группировки ${groupedItems.length} уникальных записей продаж (${syncMode})`)
    return groupedItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const sales = items as ISale[]

    if (sales.length === 0) {
      return { applied: 0 }
    }

    const syncMode = plan.syncMode || 'daily'
    console.log(`[SalesSyncJob] apply: начало сохранения ${sales.length} записей продаж в БД (${syncMode})`)

    // Используем bulkPut для идемпотентного UPSERT
    await db.sales.bulkPut(sales)

    console.log(`[SalesSyncJob] apply: сохранено ${sales.length} записей продаж`)
    return { applied: sales.length }
  }

  buildNextCheckpoint(ctx: SyncContext, plan: SyncPlan, _prev: Checkpoint | null, _fetched: number): Checkpoint {
    const syncMode = plan.syncMode || 'daily'
    const high = defaultHighWatermark(ctx.nowIso())
    
    return {
      dataset: this.dataset, // sales (always)
      cursorTime: plan.range.to,
      highWatermarkTime: syncMode === 'weekly' ? plan.range.to : high,
      updatedAt: ctx.nowIso(),
    }
  }
}
