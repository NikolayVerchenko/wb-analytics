import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncOrchestrator } from '../SyncOrchestrator'
import { InMemoryCheckpointRepository } from '../InMemoryCheckpointRepository'
import { InMemoryLoadedPeriodRepository } from '../InMemoryLoadedPeriodRepository'
import { SyncRunner } from '../SyncRunner'
import { defaultSyncPolicy } from '../SyncPolicy'
import type { SyncContext } from '../SyncJob'
import type { SyncJob } from '../SyncJob'
import type { WbApiClient } from '../../../api/WbApiClient'

describe('SyncOrchestrator runRefreshWave', () => {
  let ctx: SyncContext
  let mockRunner: SyncRunner
  let mockApiClient: WbApiClient
  let orchestrator: SyncOrchestrator

  beforeEach(() => {
    ctx = {
      checkpointRepo: new InMemoryCheckpointRepository(),
      loadedPeriodRepo: new InMemoryLoadedPeriodRepository(),
      nowIso: () => new Date().toISOString(),
    }

    const mockJob: SyncJob = {
      dataset: 'sales' as const,
      plan: vi.fn(async () => null),
      fetch: vi.fn(async () => []),
      apply: vi.fn(async () => ({ applied: 0 })),
      buildNextCheckpoint: vi.fn(() => ({
        dataset: 'sales',
        updatedAt: ctx.nowIso(),
      })),
    }

    mockApiClient = {
      setApiKey: vi.fn(),
      fetchReportPage: vi.fn(async () => []),
    } as unknown as WbApiClient

    mockRunner = new SyncRunner(ctx, { sales: mockJob })
    orchestrator = new SyncOrchestrator(ctx, mockRunner, defaultSyncPolicy, {
      priorityDatasets: ['sales'],
      historyDatasets: ['sales'],
      maxCatchupRunsPerTick: 5,
    }, { sales: mockJob }, mockApiClient)
  })

  it('should run daily refresh for priority datasets', async () => {
    const runSpy = vi.spyOn(mockRunner, 'run')

    await orchestrator.runRefreshWave()

    expect(runSpy).toHaveBeenCalledWith('sales', { refreshOverlapDays: 3 })
  })

  it('should run weekly refresh on Monday when needed', async () => {
    // Мокаем понедельник
    const monday = '2024-01-08T10:00:00.000Z'
    ctx.nowIso = () => monday

    // Мокаем отсутствие weekly checkpoint
    const getSpy = vi.spyOn(ctx.checkpointRepo, 'get')
    getSpy.mockResolvedValue(null)

    const runSpy = vi.spyOn(mockRunner, 'run')

    // Создаём новый orchestrator с обновлённым контекстом
    const orchestratorWithMonday = new SyncOrchestrator(ctx, mockRunner, defaultSyncPolicy, {
      priorityDatasets: ['sales'],
      historyDatasets: ['sales'],
      maxCatchupRunsPerTick: 5,
    }, { sales: mockJob }, mockApiClient)

    await orchestratorWithMonday.runRefreshWave()

    // Проверяем, что weekly job был вызван
    expect(getSpy).toHaveBeenCalledWith('sales_weekly')
    // run должен быть вызван для daily (sales) и возможно для weekly
    expect(runSpy).toHaveBeenCalled()
  })

  it('should not run weekly refresh outside Monday/Tuesday window', async () => {
    // Мокаем среду
    const wednesday = '2024-01-10T10:00:00.000Z'
    ctx.nowIso = () => wednesday

    const runSpy = vi.spyOn(mockRunner, 'run')
    runSpy.mockResolvedValue(null)

    const orchestratorWithWednesday = new SyncOrchestrator(ctx, mockRunner, defaultSyncPolicy, {
      priorityDatasets: ['sales'],
      historyDatasets: ['sales'],
      maxCatchupRunsPerTick: 5,
    }, { sales: mockJob }, mockApiClient)

    await orchestratorWithWednesday.runRefreshWave()

    // run должен быть вызван только для daily (sales), не для weekly
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runSpy).toHaveBeenCalledWith('sales', { refreshOverlapDays: 3 })
    expect(runSpy).not.toHaveBeenCalledWith('sales_weekly', expect.anything())
  })
})
