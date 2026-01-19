import type { DatasetKey, Checkpoint, SyncRunResult } from './types'
import type { SyncJob, SyncContext, SyncPlan } from './SyncJob'

export type RunnerOptions = {
  /**
   * Принудительный refresh последних N дней (overlap),
   * полезно для "плавающих" данных.
   */
  refreshOverlapDays?: number
}

export class SyncRunner {
  constructor(
    private readonly ctx: SyncContext,
    private readonly jobs: Record<DatasetKey, SyncJob>
  ) {}

  async run(dataset: DatasetKey, opts?: RunnerOptions): Promise<SyncRunResult | null> {
    const job = this.jobs[dataset]
    if (!job) {
      throw new Error(`SyncJob not registered for dataset=${dataset}`)
    }

    const prev = await this.ctx.checkpointRepo.get(dataset)
    
    // Если передан refreshOverlapDays, используем priority/refresh режим вместо catchup
    let plan: SyncPlan | null
    if (opts?.refreshOverlapDays !== undefined) {
      // Для priority wave используем priority режим планирования
      const { planForMode } = await import('./BasePlanner')
      const { defaultSyncPolicy } = await import('./SyncPolicy')
      const policy = defaultSyncPolicy[dataset]
      plan = await planForMode(this.ctx, dataset, prev, policy, 'priority')
      
      if (plan) {
        // Пересчитываем диапазон для refresh режима с правильным overlap
        const high = new Date(this.ctx.nowIso())
        high.setDate(high.getDate() - 1) // вчера как highWatermark
        const highIso = high.toISOString().split('T')[0]
        const from = new Date(highIso)
        from.setDate(from.getDate() - opts.refreshOverlapDays + 1)
        const fromIso = from.toISOString().split('T')[0]
        
        plan = {
          ...plan,
          mode: 'refresh',
          overlapDays: opts.refreshOverlapDays,
          range: { from: fromIso, to: highIso },
        }
      }
    } else {
      // Для catchup используем стандартный plan от job
      plan = await job.plan(this.ctx, prev)
    }

    if (!plan) return null

    const items = await job.fetch(this.ctx, plan)

    // apply должен быть идемпотентным (UPSERT)
    const { applied } = await job.apply(this.ctx, plan, items)

    // checkpoint обновляем ТОЛЬКО после успешного apply
    const nextCheckpoint = job.buildNextCheckpoint(this.ctx, plan, prev, items.length)
    await this.ctx.checkpointRepo.upsert(nextCheckpoint)

    // Фиксируем загруженный период даже при 0 записей, чтобы не перезапускать пустые недели.
    try {
      const periodType = plan.syncMode || 'daily'
      await this.ctx.loadedPeriodRepo.add({
        ds: dataset,
        pt: periodType,
        fr: plan.range.from,
        to: plan.range.to,
        la: new Date().toISOString(), // ISO datetime
        rc: applied, // recordCount
      })
    } catch (error) {
      // Не прерываем синхронизацию при ошибке записи периода
      console.error(`[SyncRunner] Ошибка при записи загруженного периода для ${dataset}:`, error)
    }

    return {
      dataset,
      fetched: items.length,
      applied,
      nextCheckpoint,
    }
  }

  /**
   * Выполняет синхронизацию по готовому плану (без построения плана через job.plan)
   * Используется для загрузки конкретных периодов, например, из массива недель
   * 
   * @param plan - Готовый план синхронизации
   * @returns Результат выполнения или null, если job не найден
   */
  async runWithPlan(plan: SyncPlan): Promise<SyncRunResult | null> {
    const job = this.jobs[plan.dataset]
    if (!job) {
      throw new Error(`SyncJob not registered for dataset=${plan.dataset}`)
    }

    const prev = await this.ctx.checkpointRepo.get(plan.dataset)

    // Выполняем план напрямую
    const items = await job.fetch(this.ctx, plan)

    // apply должен быть идемпотентным (UPSERT)
    const { applied } = await job.apply(this.ctx, plan, items)

    // checkpoint обновляем ТОЛЬКО после успешного apply
    const nextCheckpoint = job.buildNextCheckpoint(this.ctx, plan, prev, items.length)
    await this.ctx.checkpointRepo.upsert(nextCheckpoint)

    // Фиксируем загруженный период даже при 0 записей, чтобы не перезапускать пустые недели.
    try {
      const periodType = plan.syncMode || 'daily'
      await this.ctx.loadedPeriodRepo.add({
        ds: plan.dataset,
        pt: periodType,
        fr: plan.range.from,
        to: plan.range.to,
        la: new Date().toISOString(), // ISO datetime
        rc: applied, // recordCount
      })
    } catch (error) {
      // Не прерываем синхронизацию при ошибке записи периода
      console.error(`[SyncRunner] Ошибка при записи загруженного периода для ${plan.dataset}:`, error)
    }

    return {
      dataset: plan.dataset,
      fetched: items.length,
      applied,
      nextCheckpoint,
    }
  }
}
