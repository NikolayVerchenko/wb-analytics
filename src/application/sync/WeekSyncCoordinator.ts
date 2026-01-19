import type { SyncContext, SyncJob } from './SyncJob'
import type { DatasetKey } from './types'
import type { SyncPolicy } from './SyncPolicy'
import { buildWeeksArray, type SyncRange } from './calendar'
import { addDays } from './date'
import { SyncRegistry } from './SyncRegistry'
import type { WbApiClient } from '../../api/WbApiClient'
import type { ILoadedPeriod, ISale, IReturn, ILogistics, IPenalty, WBReportRow } from '../../types/db'
import { mapToSale, mapToReturn, mapToLogistics, mapToPenalty } from './jobs/helpers'
import { db } from '../../db/db'

export type WeekSyncRange = SyncRange

export class WeekSyncCoordinator {
  private readonly financeDatasets: DatasetKey[] = ['sales', 'returns', 'logistics', 'penalties']
  private readonly resumeKey: string

  constructor(
    private readonly ctx: SyncContext,
    private readonly apiClient: WbApiClient,
    private readonly policy: SyncPolicy,
    private readonly datasets: DatasetKey[]
  ) {
    this.resumeKey = `week_sync_resume_${this.datasets.join(',')}`
  }

  async run(onProgress?: (current: number, total: number, rangeLabel: string) => void): Promise<void> {
    const ranges = this.buildWeekRanges()
    await this.runRanges(ranges, onProgress, { useResume: true })
  }

  async runRanges(
    ranges: WeekSyncRange[],
    onProgress?: (current: number, total: number, rangeLabel: string) => void,
    options?: { useResume?: boolean }
  ): Promise<void> {
    const loadedByDataset = await this.loadLoadedPeriods()
    this.logStep2Ranges(loadedByDataset, ranges)
    await this.processRanges(ranges, loadedByDataset, onProgress, options)
  }

  private async loadLoadedPeriods(): Promise<Map<DatasetKey, ILoadedPeriod[]>> {
    const loadedByDataset = new Map<DatasetKey, ILoadedPeriod[]>()
    for (const dataset of this.datasets) {
      const periods = await this.ctx.loadedPeriodRepo.getByDataset(dataset)
      console.log(`[SyncStep1] loaded_periods: dataset=${dataset}, count=${periods.length}`)
      loadedByDataset.set(dataset, periods)
      for (const period of periods) {
        console.log(
          `[SyncStep1]   period: dataset=${dataset}, from=${period.fr}, to=${period.to}, type=${period.pt}, records=${period.rc}`
        )
      }
    }
    return loadedByDataset
  }

  private buildWeekRanges(): WeekSyncRange[] {
    const today = new Date()
    const lowerBound = this.policy.sales.backfillLowerBound || '2024-01-29'
    const weeks = buildWeeksArray(today, lowerBound)
    const ranges: WeekSyncRange[] = []

    for (const week of weeks.fullWeeks) {
      ranges.push({ from: week.from, to: week.to, syncMode: 'weekly' })
    }

    if (weeks.incompleteWeek) {
      ranges.unshift({
        from: weeks.incompleteWeek.from,
        to: weeks.incompleteWeek.to,
        syncMode: 'daily',
      })
    }

    console.log(`[SyncStep2] weeks: fullWeeks=${weeks.fullWeeks.length}, incompleteWeek=${weeks.incompleteWeek ? 'yes' : 'no'}`)
    return ranges
  }

  private async processRanges(
    ranges: WeekSyncRange[],
    loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>,
    onProgress?: (current: number, total: number, rangeLabel: string) => void,
    options?: { useResume?: boolean }
  ): Promise<void> {
    const useResume = options?.useResume ?? true
    const resumeFrom = useResume ? await this.loadResumeRange() : null
    const rangesToProcess = resumeFrom
      ? ranges.filter(range => range.from < resumeFrom.from || (range.from === resumeFrom.from && range.to < resumeFrom.to))
      : ranges

    const totalRanges = rangesToProcess.length
    let processedRanges = 0

    if (onProgress) {
      onProgress(processedRanges, totalRanges, '')
    }

    for (const range of rangesToProcess) {
      const rangeLabel = `${range.from} - ${range.to}`
      const missingDatasets = this.getMissingDatasets(loadedByDataset, range)

      if (missingDatasets.length === 0) {
        processedRanges += 1
        if (onProgress) {
          onProgress(processedRanges, totalRanges, rangeLabel)
        }
        continue
      }

      console.log(
        `[SyncStep4] range=${range.from}..${range.to} mode=${range.syncMode} missing=[${missingDatasets.join(', ')}]`
      )

      const missingFinance = missingDatasets.filter(ds => this.financeDatasets.includes(ds))
      const otherDatasets = missingDatasets.filter(ds => !this.financeDatasets.includes(ds))

      if (missingFinance.length > 0) {
        await this.runWithRetry(
          () => this.fetchFinanceBatch(range, missingFinance, loadedByDataset),
          `finance ${rangeLabel}`
        )
      }

      for (const dataset of otherDatasets) {
        await this.runWithRetry(
          () => this.fetchDataset(range, dataset, loadedByDataset),
          `${dataset} ${rangeLabel}`
        )
      }

      if (useResume) {
        await this.saveResumeRange(range)
      }

      processedRanges += 1
      if (onProgress) {
        onProgress(processedRanges, totalRanges, rangeLabel)
      }

      await this.delay(1000)
    }
  }

  private logStep2Ranges(loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>, ranges: WeekSyncRange[]): void {
    for (const dataset of this.datasets) {
      const loadedPeriods = loadedByDataset.get(dataset) || []
      const missingRanges = ranges.filter(range => {
        const expectedPeriodType = this.getExpectedPeriodType(dataset, range.syncMode)
        return !this.isPeriodLoaded(loadedPeriods, range.from, range.to, expectedPeriodType)
      })

      if (missingRanges.length === 0) {
        console.log(`[SyncStep2] dataset=${dataset}: missing=0 (nothing to fetch)`)
        continue
      }

      const firstRange = missingRanges[0]
      console.log(
        `[SyncStep2] dataset=${dataset}: next=${firstRange.from}..${firstRange.to} mode=${firstRange.syncMode} missing_total=${missingRanges.length}`
      )
    }
  }

  private getMissingDatasets(
    loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>,
    range: WeekSyncRange
  ): DatasetKey[] {
    return this.datasets.filter(dataset => {
      const loadedPeriods = loadedByDataset.get(dataset) || []
      const expectedPeriodType = this.getExpectedPeriodType(dataset, range.syncMode)
      return !this.isPeriodLoaded(loadedPeriods, range.from, range.to, expectedPeriodType)
    })
  }

  private async fetchDataset(range: WeekSyncRange, dataset: DatasetKey, loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>): Promise<void> {
    const runner = SyncRegistry.createRunner(this.ctx, this.apiClient, this.policy)
    console.log(`[SyncStep3] dataset=${dataset}: fetch ${range.from}..${range.to} mode=${range.syncMode}`)

    if (this.shouldFetchDailyWithinWeek(dataset, range.syncMode)) {
      let day = range.from
      while (day <= range.to) {
        const dayRange: WeekSyncRange = { from: day, to: day, syncMode: 'daily' }
        const result = await runner.runWithPlan({
          dataset,
          range: { from: dayRange.from, to: dayRange.to },
          mode: 'backfill',
          syncMode: 'daily',
        })

        if (result) {
          this.registerLoadedPeriod(loadedByDataset, dataset, dayRange, result.applied)
        }

        day = addDays(day, 1)
      }

      return
    }

    const result = await runner.runWithPlan({
      dataset,
      range: { from: range.from, to: range.to },
      mode: 'backfill',
      syncMode: range.syncMode,
    })

    if (result) {
      this.registerLoadedPeriod(loadedByDataset, dataset, range, result.applied)
    }
  }

  private async fetchFinanceBatch(range: WeekSyncRange, datasets: DatasetKey[], loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>): Promise<void> {
    console.log(
      `[SyncStep3] finance: fetch ${range.from}..${range.to} mode=${range.syncMode} datasets=${datasets.join(', ')}`
    )

    const jobs = SyncRegistry.buildJobs(this.ctx, this.apiClient, this.policy)
    const dateFrom = `${range.from}T00:00:00.000Z`
    const dateTo = `${range.to}T23:59:59.999Z`
    let lastRrdId: number | undefined = undefined

    const allSales: ISale[] = []
    const allReturns: IReturn[] = []
    const allLogistics: ILogistics[] = []
    const allPenalties: IPenalty[] = []

    while (true) {
      const pageItems = await this.apiClient.fetchReportPage(
        dateFrom,
        dateTo,
        range.syncMode === 'weekly' ? 'weekly' : 'daily',
        lastRrdId
      )

      if (pageItems.length === 0) {
        break
      }

      for (const item of pageItems as WBReportRow[]) {
        const operName = item.supplier_oper_name
        const hasLogisticsData = Boolean(item.delivery_amount || item.return_amount || item.delivery_rub)

        if (operName === 'Продажа' && datasets.includes('sales')) {
          allSales.push(mapToSale(item))
        }
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

    const salesMap = this.groupSales(allSales)
    const returnsMap = this.groupReturns(allReturns)
    const logisticsMap = this.groupLogistics(allLogistics)
    const penaltiesMap = this.groupPenalties(allPenalties)

    const plan = {
      dataset: 'sales' as DatasetKey,
      range: { from: range.from, to: range.to },
      mode: 'backfill' as const,
      syncMode: range.syncMode,
    }

    if (datasets.includes('sales')) {
      await this.applyFinanceDataset(jobs.sales, 'sales', plan, Array.from(salesMap.values()), range, loadedByDataset)
    }
    if (datasets.includes('returns')) {
      await this.applyFinanceDataset(jobs.returns, 'returns', plan, Array.from(returnsMap.values()), range, loadedByDataset)
    }
    if (datasets.includes('logistics')) {
      await this.applyFinanceDataset(jobs.logistics, 'logistics', plan, Array.from(logisticsMap.values()), range, loadedByDataset)
    }
    if (datasets.includes('penalties')) {
      await this.applyFinanceDataset(jobs.penalties, 'penalties', plan, Array.from(penaltiesMap.values()), range, loadedByDataset)
    }
  }

  private async applyFinanceDataset(
    job: SyncJob,
    dataset: DatasetKey,
    plan: { dataset: DatasetKey; range: { from: string; to: string }; mode: 'backfill'; syncMode: 'weekly' | 'daily' },
    items: unknown[],
    range: WeekSyncRange,
    loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>
  ): Promise<void> {
    const prev = await this.ctx.checkpointRepo.get(dataset)
    const { applied } = await job.apply(this.ctx, { ...plan, dataset }, items)
    const nextCheckpoint = job.buildNextCheckpoint(this.ctx, { ...plan, dataset }, prev, items.length)
    await this.ctx.checkpointRepo.upsert(nextCheckpoint)
    await this.ctx.loadedPeriodRepo.add({
      ds: dataset,
      pt: range.syncMode,
      fr: range.from,
      to: range.to,
      la: new Date().toISOString(),
      rc: applied,
    })
    this.registerLoadedPeriod(loadedByDataset, dataset, range, applied)
  }

  private groupSales(allSales: ISale[]): Map<string, ISale> {
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
    return salesMap
  }

  private groupReturns(allReturns: IReturn[]): Map<string, IReturn> {
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
    return returnsMap
  }

  private groupLogistics(allLogistics: ILogistics[]): Map<string, ILogistics> {
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
    return logisticsMap
  }

  private groupPenalties(allPenalties: IPenalty[]): Map<string, IPenalty> {
    const penaltiesMap = new Map<string, IPenalty>()
    for (const pen of allPenalties) {
      const existing = penaltiesMap.get(pen.pk)
      if (existing) {
        existing.pn = (existing.pn || 0) + (pen.pn || 0)
      } else {
        penaltiesMap.set(pen.pk, pen)
      }
    }
    return penaltiesMap
  }

  private registerLoadedPeriod(
    loadedByDataset: Map<DatasetKey, ILoadedPeriod[]>,
    dataset: DatasetKey,
    range: WeekSyncRange,
    recordCount: number
  ): void {
    const periods = loadedByDataset.get(dataset) || []
    periods.push({
      ds: dataset,
      pt: range.syncMode,
      fr: range.from,
      to: range.to,
      la: new Date().toISOString(),
      rc: recordCount,
    })
    loadedByDataset.set(dataset, periods)
  }

  private shouldFetchDailyWithinWeek(dataset: DatasetKey, syncMode: WeekSyncRange['syncMode']): boolean {
    if (syncMode !== 'weekly') {
      return false
    }
    return dataset === 'advCosts' || dataset === 'productOrders'
  }

  private getExpectedPeriodType(dataset: DatasetKey, syncMode: WeekSyncRange['syncMode']): 'daily' | 'weekly' {
    if (this.shouldFetchDailyWithinWeek(dataset, syncMode)) {
      return 'daily'
    }
    return syncMode === 'weekly' ? 'weekly' : 'daily'
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

    if (loadedPeriods.some(p => p.pt === 'weekly' && p.fr <= from && p.to >= to)) {
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

  private async loadResumeRange(): Promise<WeekSyncRange | null> {
    try {
      const entry = await db.syncRegistry.get(this.resumeKey)
      if (!entry?.value) return null
      return JSON.parse(entry.value) as WeekSyncRange
    } catch (error) {
      console.error('[WeekSyncCoordinator] Ошибка чтения resume-курсора:', error)
      return null
    }
  }

  private async saveResumeRange(range: WeekSyncRange): Promise<void> {
    try {
      await db.syncRegistry.put({
        key: this.resumeKey,
        value: JSON.stringify(range),
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error('[WeekSyncCoordinator] Ошибка записи resume-курсора:', error)
    }
  }

  private async runWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
    const maxAttempts = 5
    let attempt = 0
    let delayMs = 1500

    while (attempt < maxAttempts) {
      try {
        return await fn()
      } catch (error) {
        attempt += 1
        console.warn(`[WeekSyncCoordinator] retry ${attempt}/${maxAttempts} for ${label}:`, error)
        await this.delay(delayMs)
        delayMs = Math.min(delayMs * 2, 15000)
      }
    }

    console.error(`[WeekSyncCoordinator] failed after ${maxAttempts} attempts for ${label}`)
    return null
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}
