import type { DatasetKey, Checkpoint, SyncRunResult } from './types'
import type { CheckpointRepository } from './CheckpointRepository'
import type { LoadedPeriodRepository } from './LoadedPeriodRepository'

export type TimeRange = { from: string; to: string }

/**
 * Контекст синхронизации: зависимости, которые будут проброшены снаружи
 */
export type SyncContext = {
  checkpointRepo: CheckpointRepository
  loadedPeriodRepo: LoadedPeriodRepository
  nowIso: () => string
  // Опциональные зависимости для jobs (можно расширять)
  apiClient?: unknown
  policy?: unknown
}

/**
 * План синка для джобы: диапазон и режим
 * mode:
 *  - 'catchup' догоняем историю до highWatermark (вперёд)
 *  - 'refresh' перезаливаем небольшой overlap (например, последние 3 дня)
 *  - 'backfill' загрузка истории назад (из будущего в прошлое)
 * syncMode:
 *  - 'daily' ежедневная загрузка (по умолчанию)
 *  - 'weekly' еженедельная загрузка (для закрытых недель)
 */
export type SyncPlan = {
  dataset: DatasetKey
  range: TimeRange
  mode: 'catchup' | 'refresh' | 'backfill'
  overlapDays?: number
  syncMode?: 'daily' | 'weekly'
}

/**
 * SyncJob — одна джоба = один dataset.
 * Она:
 *  1) строит план на основе checkpoint (plan)
 *  2) ходит в API (fetch) — здесь пока просто контракт
 *  3) применяет в БД (apply) — пока контракт
 *  4) возвращает следующий checkpoint (buildNextCheckpoint)
 */
export interface SyncJob {
  dataset: DatasetKey

  plan(ctx: SyncContext, checkpoint: Checkpoint | null): Promise<SyncPlan | null>

  fetch(ctx: SyncContext, plan: SyncPlan): Promise<unknown[]>

  apply(ctx: SyncContext, plan: SyncPlan, items: unknown[]): Promise<{ applied: number }>

  buildNextCheckpoint(ctx: SyncContext, plan: SyncPlan, prev: Checkpoint | null, fetched: number): Checkpoint
}
