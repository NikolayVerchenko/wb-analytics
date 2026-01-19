import type { DatasetKey } from './types'
import { getBackfillCheckpointKey, getWeeklyCheckpointKey } from './types'
import type { SyncRunner } from './SyncRunner'
import type { SyncPolicy } from './SyncPolicy'
import type { SyncContext, SyncJob } from './SyncJob'
import { buildSalesPlan, buildSalesBackfillPlan, getSalesBackfillProgress, type BackfillProgress } from './planning'
import type { WbApiClient } from '../../api/WbApiClient'
import { addDays, defaultHighWatermark } from './date'
import { buildWeeksArray } from './calendar'
import type { WBReportRow, IReturn, ILogistics, IPenalty, ILoadedPeriod } from '../../types/db'
import { mapToReturn, mapToLogistics, mapToPenalty } from './jobs/helpers'

export type OrchestratorOptions = {
  /**
   * Какие датасеты синкаем в приоритете при старте (обычно все финансовые)
   */
  priorityDatasets: DatasetKey[]

  /**
   * Какие датасеты догоняем в фоне (обычно те же + тяжелые)
   */
  historyDatasets: DatasetKey[]

  /**
   * За один проход catchup делаем максимум N запусков (чтобы не повесить устройство)
   */
  maxCatchupRunsPerTick: number
}

export class SyncOrchestrator {
  constructor(
    private readonly ctx: SyncContext,
    private readonly runner: SyncRunner,
    private readonly policy: SyncPolicy,
    private readonly opts: OrchestratorOptions,
    private readonly jobs: Record<DatasetKey, SyncJob>,
    private readonly apiClient: WbApiClient
  ) {}

  /**
   * Быстрый старт: priority wave
   * Идея: UI сразу получает актуальные последние N дней
   * 
   * For sales: uses calendar-aware planning (buildSalesPlan) to handle daily + weekly
   * For finance datasets (returns, logistics, penalties): загружаем одним запросом из одного API
   */
  async runPriorityWave(): Promise<void> {
    console.log(`[SyncOrchestrator] runPriorityWave: начало загрузки для ${this.opts.priorityDatasets.length} datasets`)
    
    const errors: Array<{ dataset: string; error: Error }> = []
    
    // Финансовые datasets, которые загружаются из одного API
    const financeDatasets: DatasetKey[] = ['returns', 'logistics', 'penalties']
    const financeDatasetsToLoad = financeDatasets.filter(ds => this.opts.priorityDatasets.includes(ds) && this.jobs[ds])
    
    // Загружаем финансовые datasets одним запросом, если есть хотя бы один
    if (financeDatasetsToLoad.length > 0) {
      try {
        console.log(`[SyncOrchestrator] runPriorityWave: загрузка финансовых datasets одним запросом: ${financeDatasetsToLoad.join(', ')}`)
        await this.runFinancePriorityWave(financeDatasetsToLoad)
        console.log(`[SyncOrchestrator] runPriorityWave: завершена загрузка финансовых datasets`)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(`[SyncOrchestrator] runPriorityWave: ошибка при загрузке финансовых datasets:`, err)
        // Добавляем ошибку для каждого dataset
        for (const dataset of financeDatasetsToLoad) {
          errors.push({ dataset, error: err })
        }
      }
    }
    
    // Обрабатываем остальные datasets по отдельности
    for (const dataset of this.opts.priorityDatasets) {
      // Пропускаем datasets, для которых job не зарегистрирован
      if (!this.jobs[dataset]) {
        console.warn(`[SyncOrchestrator] runPriorityWave: пропущен dataset=${dataset} (job не зарегистрирован)`)
        continue
      }
      
      // Пропускаем финансовые datasets, которые уже загружены
      if (financeDatasetsToLoad.includes(dataset)) {
        continue
      }
      
      console.log(`[SyncOrchestrator] runPriorityWave: загрузка dataset=${dataset}`)
      
      try {
        if (dataset === 'sales') {
          // Use calendar-aware planning for sales
          await this.runSalesPriorityWave()
        } else {
          // Other datasets: standard priority wave
          await this.runner.run(dataset, { refreshOverlapDays: this.policy[dataset].refreshOverlapDays })
        }
        
        console.log(`[SyncOrchestrator] runPriorityWave: завершена загрузка dataset=${dataset}`)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(`[SyncOrchestrator] runPriorityWave: ошибка при загрузке dataset=${dataset}:`, err)
        errors.push({ dataset, error: err })
        // Продолжаем загрузку других датасетов
      }
    }
    
    if (errors.length > 0) {
      console.warn(`[SyncOrchestrator] runPriorityWave: завершена с ${errors.length} ошибками из ${this.opts.priorityDatasets.length} datasets`)
      // Бросаем ошибку только если все датасеты упали
      if (errors.length === this.opts.priorityDatasets.length) {
        throw new Error(`Все датасеты завершились с ошибками: ${errors.map(e => `${e.dataset}: ${e.error.message}`).join(', ')}`)
      }
    } else {
      console.log(`[SyncOrchestrator] runPriorityWave: завершена загрузка всех datasets`)
    }
  }

  /**
   * Загружает все финансовые datasets (returns, logistics, penalties) одним запросом к API
   * Все они приходят из одного endpoint /reportDetailByPeriod и различаются только по supplier_oper_name
   */
  private async runFinancePriorityWave(datasets: DatasetKey[]): Promise<void> {
    // Определяем общий период для всех финансовых datasets
    // Берем максимальный priorityDays среди всех datasets
    const maxPriorityDays = Math.max(...datasets.map(ds => this.policy[ds].priorityDays))
    const high = defaultHighWatermark(this.ctx.nowIso())
    const lowerBound = addDays(high, -maxPriorityDays + 1)
    
    console.log(`[SyncOrchestrator] runFinancePriorityWave: загрузка по массиву недель за период ${lowerBound} - ${high} для datasets: ${datasets.join(', ')}`)
    
    // Загружаем все данные одним запросом с пагинацией
    // Примечание: sales не загружается здесь, так как у него своя calendar-aware логика
    const allReturns: IReturn[] = []
    const allLogistics: ILogistics[] = []
    const allPenalties: IPenalty[] = []
    
    const weeks = buildWeeksArray(new Date(this.ctx.nowIso()), lowerBound)
    const ranges: Array<{ from: string; to: string; syncMode: 'weekly' | 'daily' }> = []

    for (const week of weeks.fullWeeks) {
      if (week.to <= high) {
        ranges.push({ from: week.from, to: week.to, syncMode: 'weekly' })
      }
    }

    if (weeks.incompleteWeek) {
      const dayFrom = weeks.incompleteWeek.from < lowerBound ? lowerBound : weeks.incompleteWeek.from
      const dayTo = weeks.incompleteWeek.to > high ? high : weeks.incompleteWeek.to
      if (dayFrom <= dayTo) {
        ranges.push({ from: dayFrom, to: dayTo, syncMode: 'daily' })
      }
    }

    ranges.sort((a, b) => a.from.localeCompare(b.from))

    const loadedByDataset = new Map<DatasetKey, ILoadedPeriod[]>()
    for (const dataset of datasets) {
      loadedByDataset.set(dataset, await this.ctx.loadedPeriodRepo.getByDataset(dataset))
    }

    const rangesToLoad = ranges.filter(range => {
      const expectedPeriodType = range.syncMode === 'weekly' ? 'weekly' : 'daily'
      return datasets.some(dataset => {
        const loadedPeriods = loadedByDataset.get(dataset) || []
        return !this.isPeriodLoaded(loadedPeriods, range.from, range.to, expectedPeriodType)
      })
    })

    if (rangesToLoad.length < ranges.length) {
      console.log(`[SyncOrchestrator] runFinancePriorityWave: пропущено диапазонов (уже в БД)=${ranges.length - rangesToLoad.length}`)
    }

    for (const range of rangesToLoad) {
      const dateFrom = `${range.from}T00:00:00.000Z`
      const dateTo = `${range.to}T23:59:59.999Z`
      let lastRrdId: number | undefined = undefined

      console.log(`[SyncOrchestrator] runFinancePriorityWave: период ${range.from} - ${range.to}, mode=${range.syncMode}`)

      while (true) {
        const pageItems = await this.apiClient.fetchReportPage(dateFrom, dateTo, range.syncMode, lastRrdId)

        if (pageItems.length === 0) {
          break
        }

        // Распределяем данные по типам (только returns, logistics, penalties)
        for (const item of pageItems as WBReportRow[]) {
          const operName = item.supplier_oper_name
          const hasLogisticsData = Boolean(item.delivery_amount || item.return_amount || item.delivery_rub)

          if (operName === 'Возврат' && datasets.includes('returns')) {
            allReturns.push(mapToReturn(item))
          }
          if (hasLogisticsData && datasets.includes('logistics')) {
            allLogistics.push(mapToLogistics(item))
          }
          if (item.penalty && item.penalty !== 0 && datasets.includes('penalties')) {
            allPenalties.push(mapToPenalty(item))
          }
        }

        const lastItem = pageItems[pageItems.length - 1] as WBReportRow
        lastRrdId = lastItem.rrd_id

        if (pageItems.length < 100000) {
          break
        }
      }
    }
    
    console.log(`[SyncOrchestrator] runFinancePriorityWave: загружено из API - returns: ${allReturns.length}, logistics: ${allLogistics.length}, penalties: ${allPenalties.length}`)
    if (allLogistics.length > 0) {
      const totals = allLogistics.reduce(
        (acc, item) => {
          acc.dl += item.dl || 0
          acc.rt += item.rt || 0
          return acc
        },
        { dl: 0, rt: 0 }
      )
      console.log(`[SyncOrchestrator] runFinancePriorityWave: суммы из API для логистики: dl=${totals.dl}, rt=${totals.rt}`)
    }
    
    // Группируем и сохраняем данные для каждого dataset
    // Создаем базовый plan (dataset будет переопределен для каждого dataset)
    const basePlan = {
      mode: 'refresh' as const,
      range: { from: lowerBound, to: high },
      syncMode: 'daily' as const,
      overlapDays: maxPriorityDays,
    }
    
    // Сохраняем данные и обновляем checkpoint'ы для каждого dataset
    for (const dataset of datasets) {
      const job = this.jobs[dataset]
      if (!job) continue
      
      let items: unknown[] = []
      
      if (dataset === 'returns') {
        // Группируем returns по pk
        const returnsMap = new Map<string, IReturn>()
        for (const ret of allReturns) {
          const existing = returnsMap.get(ret.pk)
          if (existing) {
            existing.qt = (existing.qt || 0) + (ret.qt || 0)
            existing.pv = (existing.pv || 0) + (ret.pv || 0)
            existing.pa = (existing.pa || 0) + (ret.pa || 0)
            existing.pz = (existing.pz || 0) + (ret.pz || 0)
          } else {
            returnsMap.set(ret.pk, ret)
          }
        }
        items = Array.from(returnsMap.values())
      } else if (dataset === 'logistics') {
        // Группируем logistics по pk
        const logisticsMap = new Map<string, ILogistics>()
        for (const log of allLogistics) {
          const existing = logisticsMap.get(log.pk)
          if (existing) {
            existing.dl = (existing.dl || 0) + (log.dl || 0)
            existing.rt = (existing.rt || 0) + (log.rt || 0)
            existing.dr = (existing.dr || 0) + (log.dr || 0)
          } else {
            logisticsMap.set(log.pk, log)
          }
        }
        items = Array.from(logisticsMap.values())
      } else if (dataset === 'penalties') {
        // Группируем penalties по pk
        const penaltiesMap = new Map<string, IPenalty>()
        for (const pen of allPenalties) {
          const existing = penaltiesMap.get(pen.pk)
          if (existing) {
            existing.pn = (existing.pn || 0) + (pen.pn || 0)
          } else {
            penaltiesMap.set(pen.pk, pen)
          }
        }
        items = Array.from(penaltiesMap.values())
      }
      
      if (items.length > 0) {
        const execPlan = { ...basePlan, dataset }
        await job.apply(this.ctx, execPlan, items)
        const prev = await this.ctx.checkpointRepo.get(dataset)
        const nextCheckpoint = job.buildNextCheckpoint(this.ctx, execPlan, prev, items.length)
        await this.ctx.checkpointRepo.upsert(nextCheckpoint)
        console.log(`[SyncOrchestrator] runFinancePriorityWave: сохранено ${items.length} записей для dataset=${dataset}`)
      } else {
        console.log(`[SyncOrchestrator] runFinancePriorityWave: нет данных для dataset=${dataset}, пропускаем`)
      }
    }
  }

  /**
   * Calendar-aware priority wave for sales
   * Handles both daily and weekly plans from buildSalesPlan
   */
  private async runSalesPriorityWave(): Promise<void> {
    const salesCheckpoint = await this.ctx.checkpointRepo.get('sales')
    const weeklyKey = getWeeklyCheckpointKey('sales')
    const weeklyCheckpoint = await this.ctx.checkpointRepo.get(weeklyKey)
    const today = new Date(this.ctx.nowIso())
    const job = this.jobs['sales']
    
    if (!job) {
      throw new Error('SalesSyncJob not registered')
    }
    
    // Get plans from buildSalesPlan (daily + optional weekly)
    // Используем weeklyCheckpoint для проверки, сделан ли weekly refresh
    const plans = buildSalesPlan('sales', this.policy.sales, weeklyCheckpoint, today)
    
    // Execute all plans (daily first, then weekly if exists)
    let currentSalesCheckpoint = salesCheckpoint
    let currentWeeklyCheckpoint = weeklyCheckpoint
    
    for (const plan of plans) {
      // Создаём execPlan с overlapDays для refresh (без мутации исходного plan)
      const execPlan = plan.mode === 'refresh' && this.policy.sales.refreshOverlapDays !== undefined
        ? { ...plan, overlapDays: this.policy.sales.refreshOverlapDays }
        : plan
      
      // Execute plan: fetch
      const items = await job.fetch(this.ctx, execPlan)
      
      if (plan.syncMode === 'weekly') {
        // Weekly план: обновляем checkpoint только если реально пришли данные
        if (items.length === 0) {
          // Нет данных - пропускаем apply и не обновляем checkpoint
          continue
        }
        
        await job.apply(this.ctx, execPlan, items)
        const nextWeeklyCheckpoint = job.buildNextCheckpoint(this.ctx, execPlan, currentWeeklyCheckpoint, items.length)
        await this.ctx.checkpointRepo.upsert({
          ...nextWeeklyCheckpoint,
          dataset: weeklyKey, // 'sales_weekly'
        })
        currentWeeklyCheckpoint = { ...nextWeeklyCheckpoint, dataset: weeklyKey }
      } else {
        // Daily план обновляет sales checkpoint (не weekly)
        await job.apply(this.ctx, execPlan, items)
        const nextSalesCheckpoint = job.buildNextCheckpoint(this.ctx, execPlan, currentSalesCheckpoint, items.length)
        await this.ctx.checkpointRepo.upsert(nextSalesCheckpoint)
        currentSalesCheckpoint = nextSalesCheckpoint
      }
    }
  }

  /**
   * Фоновый догон истории:
   * - несколько "тиков"
   * - в каждом тике ограничиваем число запусков
   */
  async runCatchupTick(): Promise<{ runs: number }> {
    let runs = 0

    for (const dataset of this.opts.historyDatasets) {
      if (runs >= this.opts.maxCatchupRunsPerTick) break

      // Пропускаем datasets, для которых job не зарегистрирован
      if (!this.jobs[dataset]) {
        console.warn(`[SyncOrchestrator] runCatchupTick: пропущен dataset=${dataset} (job не зарегистрирован)`)
        continue
      }

      // один запуск = один chunk
      const res = await this.runner.run(dataset)
      if (res) runs++
    }

    return { runs }
  }

  /**
   * Refresh tick — пересинк последних overlapDays (плавающие данные)
   * Для sales: uses calendar-aware planning (buildSalesPlan) which includes weekly if needed
   */
  async runRefreshWave(): Promise<void> {
    for (const dataset of this.opts.priorityDatasets) {
      // Пропускаем datasets, для которых job не зарегистрирован
      if (!this.jobs[dataset]) {
        console.warn(`[SyncOrchestrator] runRefreshWave: пропущен dataset=${dataset} (job не зарегистрирован)`)
        continue
      }
      
      if (dataset === 'sales') {
        // Use calendar-aware planning for sales (includes weekly if Mon/Tue)
        await this.runSalesPriorityWave()
      } else {
        // Other datasets: standard refresh
        await this.runner.run(dataset, { refreshOverlapDays: this.policy[dataset].refreshOverlapDays })
      }
    }
  }

  /**
   * Backfill tick — загрузка истории продаж назад по полным неделям
   * Работает только для 'sales', использует отдельный checkpoint 'sales_backfill'
   * Выполняет максимум 1 неделю за тик
   * 
   * Проверяет policy.backfillEnabled перед выполнением
   */
  async runBackfillTick(): Promise<{ runs: number; completed: boolean; progress: BackfillProgress }> {
    const dataset: DatasetKey = 'sales'
    
    // Проверяем, включен ли backfill для sales
    if (!this.policy.sales.backfillEnabled) {
      return { 
        runs: 0, 
        completed: true, 
        progress: { 
          lowerBound: this.policy.sales.backfillLowerBound || '2024-01-29',
          weeksDone: 0,
          weeksRemaining: 0,
          percent: 100,
          completed: true 
        } 
      }
    }
    
    const key = getBackfillCheckpointKey(dataset)
    const checkpoint = await this.ctx.checkpointRepo.get(key)
    const today = new Date(this.ctx.nowIso())
    const lowerBound = this.policy.sales.backfillLowerBound || '2024-01-29'
    
    // Вычисляем прогресс до построения плана
    let progress = getSalesBackfillProgress(checkpoint, today, lowerBound)
    
    const plan = buildSalesBackfillPlan(this.policy.sales, checkpoint, today)
    
    if (!plan) {
      return { runs: 0, completed: true, progress: { ...progress, completed: true } }
    }

    const job = this.jobs[dataset]
    if (!job) {
      throw new Error(`SalesSyncJob not registered for backfill`)
    }

    console.log(`[SyncOrchestrator] runBackfillTick: план создан, неделя ${plan.range.from} - ${plan.range.to}, checkpoint.cursorTime=${checkpoint?.cursorTime || 'null'}`)
    
    // Execute plan: fetch
    const items = await job.fetch(this.ctx, plan)
    
    console.log(`[SyncOrchestrator] runBackfillTick: загружено ${items.length} записей для недели ${plan.range.from} - ${plan.range.to}`)
    
    // Если данных нет, все равно обновляем checkpoint, чтобы продолжить загрузку следующей недели
    // Это важно, так как для старых недель данных может не быть, но мы должны продолжать движение назад
    if (items.length === 0) {
      console.log(`[SyncOrchestrator] runBackfillTick: нет данных для недели ${plan.range.from} - ${plan.range.to}, обновляем checkpoint для продолжения`)
      
      // Обновляем checkpoint на следующую неделю назад, даже если данных нет
      const nextCheckpoint = job.buildNextCheckpoint(this.ctx, plan, checkpoint, 0)
      
      // Сохраняем checkpoint с отдельным ключом для backfill
      await this.ctx.checkpointRepo.upsert({
        ...nextCheckpoint,
        dataset: key, // 'sales_backfill'
      })
      
      // Пересчитываем прогресс на основе нового checkpoint
      const updatedCheckpoint = await this.ctx.checkpointRepo.get(key)
      progress = getSalesBackfillProgress(updatedCheckpoint, today, lowerBound)
      
      console.log(`[SyncOrchestrator] runBackfillTick: checkpoint обновлен, cursorTime=${nextCheckpoint.cursorTime}, progress: ${progress.percent}% (${progress.weeksDone}/${progress.weeksDone + progress.weeksRemaining} недель)`)
      
      return { 
        runs: 1, // Считаем как выполненный запуск, даже если данных нет
        completed: progress.completed, 
        progress: { ...progress, currentWeek: plan.range } 
      }
    }
    
    await job.apply(this.ctx, plan, items)
    const nextCheckpoint = job.buildNextCheckpoint(this.ctx, plan, checkpoint, items.length)
    
    // Сохраняем checkpoint с отдельным ключом для backfill
    await this.ctx.checkpointRepo.upsert({
      ...nextCheckpoint,
      dataset: key, // 'sales_backfill'
    })

    // Пересчитываем прогресс на основе нового checkpoint
    const updatedCheckpoint = await this.ctx.checkpointRepo.get(key)
    progress = getSalesBackfillProgress(updatedCheckpoint, today, lowerBound)
    
    console.log(`[SyncOrchestrator] runBackfillTick: сохранено ${items.length} записей, checkpoint обновлен, cursorTime=${nextCheckpoint.cursorTime}, progress: ${progress.percent}% (${progress.weeksDone}/${progress.weeksDone + progress.weeksRemaining} недель)`)

    return { runs: 1, completed: progress.completed, progress }
  }

  private isPeriodLoaded(
    loadedPeriods: ILoadedPeriod[],
    from: string,
    to: string,
    expectedPeriodType: 'daily' | 'weekly'
  ): boolean {
    if (expectedPeriodType === 'daily') {
      return loadedPeriods.some(p => p.fr === from && p.to === to && p.pt === 'daily')
    }

    if (loadedPeriods.some(p => p.fr === from && p.to === to && p.pt === 'weekly')) {
      return true
    }

    if (loadedPeriods.some(p => p.pt === 'daily' && p.fr <= from && p.to >= to)) {
      return true
    }

    const dailySet = new Set(
      loadedPeriods
        .filter(p => p.pt === 'daily')
        .map(p => `${p.fr}_${p.to}`)
    )

    let day = from
    while (day <= to) {
      if (!dailySet.has(`${day}_${day}`)) {
        return false
      }
      day = addDays(day, 1)
    }

    return true
  }
}
