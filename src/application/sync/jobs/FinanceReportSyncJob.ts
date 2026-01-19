import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { ISale, IReturn, ILogistics, IPenalty, WBReportRow } from '../../../types/db'
import { mapToSale, mapToReturn, mapToLogistics, mapToPenalty } from './helpers'

/**
 * Объединенный SyncJob для загрузки финансовых данных из одного API
 * Загружает sales, returns, logistics, penalties одним запросом
 */
export class FinanceReportSyncJob implements SyncJob {
  dataset = 'sales' as const // Используем sales как основной dataset для checkpoint

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  /**
   * Загружает все финансовые данные одним запросом и возвращает их разделенными по типам
   */
  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    const syncMode = plan.syncMode || 'daily'
    console.log(`[FinanceReportSyncJob] fetch: начало загрузки финансовых данных (${syncMode}) за период ${plan.range.from} - ${plan.range.to}`)

    const dateFrom = `${plan.range.from}T00:00:00.000Z`
    const dateTo = `${plan.range.to}T23:59:59.999Z`

    const allSales: ISale[] = []
    const allReturns: IReturn[] = []
    const allLogistics: ILogistics[] = []
    const allPenalties: IPenalty[] = []

    let lastRrdId: number | undefined = undefined

    // Один запрос для всех типов данных
    while (true) {
      const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, syncMode === 'weekly' ? 'weekly' : 'daily', lastRrdId)

      if (pageItems.length === 0) {
        break
      }

      const reportItems = pageItems as WBReportRow[]

      // Разделяем данные по типам операций
      for (const item of reportItems) {
        const hasLogisticsData = Boolean(item.delivery_amount || item.return_amount || item.delivery_rub)

        if (item.supplier_oper_name === 'Продажа') {
          allSales.push(mapToSale(item))
        } else if (item.supplier_oper_name === 'Возврат') {
          allReturns.push(mapToReturn(item))
        }
        if (hasLogisticsData) {
          allLogistics.push(mapToLogistics(item))
        }

        // Штрафы могут быть в любой операции
        if (item.penalty && item.penalty !== 0) {
          allPenalties.push(mapToPenalty(item))
        }
      }

      const lastItem = reportItems[reportItems.length - 1]
      lastRrdId = lastItem.rrd_id

      if (pageItems.length < 100000) {
        break
      }
    }

    console.log(`[FinanceReportSyncJob] fetch: загружено sales=${allSales.length}, returns=${allReturns.length}, logistics=${allLogistics.length}, penalties=${allPenalties.length}`)

    // Группируем продажи по pk (как в SalesSyncJob)
    const salesMap = new Map<string, ISale>()
    for (const sale of allSales) {
      const existing = salesMap.get(sale.pk)
      if (existing) {
        existing.qt = (existing.qt || 0) + (sale.qt || 0)
        existing.pv = (existing.pv || 0) + (sale.pv || 0)
        existing.pa = (existing.pa || 0) + (sale.pa || 0)
        existing.pz = (existing.pz || 0) + (sale.pz || 0)
      } else {
        salesMap.set(sale.pk, sale)
      }
    }

    // Возвращаем объект с разделенными данными
    // Это будет обработано специальным образом в apply
    return [{
      sales: Array.from(salesMap.values()),
      returns: allReturns,
      logistics: allLogistics,
      penalties: allPenalties,
    }]
  }

  /**
   * Сохраняет все типы данных параллельно
   */
  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    if (items.length === 0) {
      return { applied: 0 }
    }

    const data = items[0] as {
      sales: ISale[]
      returns: IReturn[]
      logistics: ILogistics[]
      penalties: IPenalty[]
    }

    const syncMode = plan.syncMode || 'daily'
    console.log(`[FinanceReportSyncJob] apply: сохранение финансовых данных (${syncMode})`)

    // Сохраняем все типы данных параллельно
    const [salesCount, returnsCount, logisticsCount, penaltiesCount] = await Promise.all([
      data.sales.length > 0 ? db.sales.bulkPut(data.sales).then(() => data.sales.length) : Promise.resolve(0),
      data.returns.length > 0 ? db.returns.bulkPut(data.returns).then(() => data.returns.length) : Promise.resolve(0),
      data.logistics.length > 0 ? db.logistics.bulkPut(data.logistics).then(() => data.logistics.length) : Promise.resolve(0),
      data.penalties.length > 0 ? db.penalties.bulkPut(data.penalties).then(() => data.penalties.length) : Promise.resolve(0),
    ])

    const totalApplied = salesCount + returnsCount + logisticsCount + penaltiesCount
    console.log(`[FinanceReportSyncJob] apply: сохранено sales=${salesCount}, returns=${returnsCount}, logistics=${logisticsCount}, penalties=${penaltiesCount}, всего=${totalApplied}`)

    return { applied: totalApplied }
  }

  buildNextCheckpoint(ctx: SyncContext, plan: SyncPlan, _prev: Checkpoint | null, _fetched: number): Checkpoint {
    const syncMode = plan.syncMode || 'daily'
    const high = defaultHighWatermark(ctx.nowIso())
    
    return {
      dataset: this.dataset,
      cursorTime: plan.range.to,
      highWatermarkTime: syncMode === 'weekly' ? plan.range.to : high,
      updatedAt: ctx.nowIso(),
    }
  }
}
