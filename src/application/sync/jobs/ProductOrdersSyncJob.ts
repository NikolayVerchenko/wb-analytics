import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'
import type { DatasetPolicy } from '../SyncPolicy'
import { planForMode } from '../BasePlanner'
import { defaultHighWatermark } from '../date'
import type { WbApiClient } from '../../../api/WbApiClient'
import { db } from '../../../db/db'
import type { IProductOrder } from '../../../types/db'

export class ProductOrdersSyncJob implements SyncJob {
  dataset = 'productOrders' as const

  constructor(
    private readonly apiClient: WbApiClient,
    private readonly policy: DatasetPolicy
  ) {}

  async plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null> {
    return planForMode(ctx, this.dataset, checkpoint, this.policy, 'catchup')
  }

  async fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]> {
    console.log(`[ProductOrdersSyncJob] fetch: начало загрузки ${plan.dataset} за период ${plan.range.from} - ${plan.range.to}`)

    const allItems: IProductOrder[] = []
    let offset = 0
    const limit = 1000 // Максимальный лимит API
    let pages = 0

    while (true) {
      const result = await this.apiClient.fetchOrdersStats(plan.range.from, plan.range.to, offset, limit)
      pages += 1
      console.log(`[ProductOrdersSyncJob] fetch: page=${pages}, products=${result.products.length}, hasMore=${result.hasMore}`)

      if (result.products.length === 0) {
        break
      }

      // Преобразуем данные API в формат IProductOrder
      // Структура ответа API: { products: [{ product: {...}, statistic: { selected: {...} } }] }
      for (const item of result.products) {
        const product = item.product
        const statistic = item.statistic?.selected
        
        if (!product || !statistic || !statistic.period) {
          continue
        }
        
        // Используем дату из периода статистики или из плана
        const periodStart = statistic.period.start
        const date = periodStart ? (typeof periodStart === 'string' ? periodStart.split('T')[0] : new Date(periodStart).toISOString().split('T')[0]) : plan.range.from
        const pk = `${date}_${product.nmId}`
        
        allItems.push({
          pk,
          dt: date,
          ni: product.nmId,
          sa: product.vendorCode || '',
          bc: product.brandName || '',
          sj: product.subjectName || '',
          oc: statistic.orderCount || 0,
          os: statistic.orderSum || 0,
          vsc: statistic.openCount || 0,
          cc: statistic.cartCount || 0,
          bc_cnt: statistic.buyoutCount || 0,
          bs: statistic.buyoutSum || 0,
          cnc: statistic.cancelCount || 0,
          cns: statistic.cancelSum || 0,
          fav: statistic.addToWishlist || 0,
        })
      }

      if (!result.hasMore) {
        break
      }

      offset += limit
    }

    const ordersSum = allItems.reduce((sum, item) => sum + (item.os || 0), 0)
    const ordersCount = allItems.reduce((sum, item) => sum + (item.oc || 0), 0)
    console.log(`[ProductOrdersSyncJob] fetch: загружено ${allItems.length} записей заказов, ordersCount=${ordersCount}, ordersSum=${ordersSum}`)
    if (allItems.length > 0) {
      console.log(`[ProductOrdersSyncJob] fetch: sample:`, allItems.slice(0, 3))
    }
    return allItems
  }

  async apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }> {
    const productOrders = items as IProductOrder[]

    if (productOrders.length === 0) {
      return { applied: 0 }
    }

    const savedSum = productOrders.reduce((sum, item) => sum + (item.os || 0), 0)
    const savedCount = productOrders.reduce((sum, item) => sum + (item.oc || 0), 0)
    console.log(`[ProductOrdersSyncJob] apply: начало сохранения ${productOrders.length} записей заказов в БД, ordersCount=${savedCount}, ordersSum=${savedSum}`)
    await db.product_orders.bulkPut(productOrders)
    console.log(`[ProductOrdersSyncJob] apply: сохранено ${productOrders.length} записей заказов`)
    return { applied: productOrders.length }
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
