export type DatasetKey =
  | 'sales'
  | 'returns'
  | 'logistics'
  | 'penalties'
  | 'advCosts'
  | 'storageCosts'
  | 'acceptanceCosts'
  | 'productOrders'
  | 'supplies'

export type SyncStatus = 'idle' | 'running' | 'paused' | 'error'

export type CheckpointKey = string

export type Checkpoint = {
  dataset: CheckpointKey

  /**
   * До какого момента по времени данные гарантированно загружены
   * ISO строка, без timezone-магии
   */
  cursorTime?: string

  /**
   * Для постраничных API (pageToken / cursor / offset)
   */
  cursorToken?: string

  /**
   * Верхняя стабильная граница (например: "вчера 23:59")
   * За неё синк пока не заходит
   */
  highWatermarkTime?: string

  /**
   * Когда checkpoint был обновлён
   */
  updatedAt: string
}

export type SyncRunResult = {
  dataset: DatasetKey
  fetched: number
  applied: number
  nextCheckpoint: Checkpoint
}

/**
 * Возвращает ключ checkpoint для backfill стратегии
 */
export const getBackfillCheckpointKey = (dataset: DatasetKey): string =>
  `${dataset}_backfill`

/**
 * Возвращает ключ checkpoint для weekly стратегии
 */
export const getWeeklyCheckpointKey = (dataset: DatasetKey): string =>
  `${dataset}_weekly`
