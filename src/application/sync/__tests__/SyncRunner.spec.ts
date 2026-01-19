import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncRunner } from '../SyncRunner'
import { InMemoryCheckpointRepository } from '../InMemoryCheckpointRepository'
import { InMemoryLoadedPeriodRepository } from '../InMemoryLoadedPeriodRepository'
import type { SyncJob, SyncContext, SyncPlan } from '../SyncJob'
import type { Checkpoint } from '../types'

describe('SyncRunner', () => {
  let ctx: SyncContext
  let mockJob: SyncJob

  beforeEach(() => {
    ctx = {
      checkpointRepo: new InMemoryCheckpointRepository(),
      loadedPeriodRepo: new InMemoryLoadedPeriodRepository(),
      nowIso: () => new Date().toISOString(),
    }

    mockJob = {
      dataset: 'sales' as const,
      plan: vi.fn(async () => ({
        dataset: 'sales' as const,
        mode: 'catchup' as const,
        range: { from: '2024-01-01', to: '2024-01-31' },
      })),
      fetch: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
      apply: vi.fn(async () => ({ applied: 2 })),
      buildNextCheckpoint: vi.fn((_ctx, plan, _prev, _fetched) => ({
        dataset: plan.dataset,
        cursorTime: plan.range.to,
        updatedAt: ctx.nowIso(),
      })),
    }
  })

  it('should update checkpoint only after successful apply', async () => {
    const runner = new SyncRunner(ctx, { sales: mockJob })

    await runner.run('sales')

    // Проверяем, что checkpoint был обновлён
    const checkpoint = await ctx.checkpointRepo.get('sales')
    expect(checkpoint).not.toBeNull()
    expect(checkpoint?.cursorTime).toBe('2024-01-31')
    expect(checkpoint?.dataset).toBe('sales')

    // Проверяем порядок вызовов
    expect(mockJob.plan).toHaveBeenCalledBefore(mockJob.fetch as any)
    expect(mockJob.fetch).toHaveBeenCalledBefore(mockJob.apply as any)
    expect(mockJob.apply).toHaveBeenCalledBefore(mockJob.buildNextCheckpoint as any)
  })

  it('should return null when plan returns null', async () => {
    mockJob.plan = vi.fn(async () => null)
    const runner = new SyncRunner(ctx, { sales: mockJob })

    const result = await runner.run('sales')

    expect(result).toBeNull()
    expect(mockJob.fetch).not.toHaveBeenCalled()
    expect(mockJob.apply).not.toHaveBeenCalled()
  })

  it('should throw error when job not registered', async () => {
    const runner = new SyncRunner(ctx, {})

    await expect(runner.run('sales')).rejects.toThrow('SyncJob not registered')
  })
})
