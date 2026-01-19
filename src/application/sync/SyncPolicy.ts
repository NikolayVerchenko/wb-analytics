import type { DatasetKey } from './types'

export type DatasetPolicy = {
  /**
   * Сколько дней грузим приоритетно (для "быстрого старта")
   */
  priorityDays: number

  /**
   * Overlap дней для refresh (плавающие данные)
   */
  refreshOverlapDays: number

  /**
   * Размер чанка для catchup (дней за один запуск)
   * чтобы не упираться в лимиты API/таймауты
   */
  catchupChunkDays: number

  /**
   * Максимальная глубина истории (сколько дней назад можно догонять)
   * null = без лимита (не советую)
   */
  maxHistoryDays: number | null

  /**
   * Насколько "часто" хотим делать refresh (в минутах)
   * Оркестратор сможет использовать это позже
   */
  refreshEveryMinutes: number

  /**
   * Включена ли стратегия backfill (загрузка истории назад)
   * По умолчанию: true
   */
  backfillEnabled?: boolean

  /**
   * Размер чанка для backfill (дней за один запуск)
   * Для sales используется неделя (7 дней)
   * По умолчанию: 7
   */
  backfillChunkDays?: number

  /**
   * Нижняя граница для backfill (дата, раньше которой не загружаем)
   * По умолчанию: '2024-01-29'
   */
  backfillLowerBound?: string
}

export type SyncPolicy = Record<DatasetKey, DatasetPolicy>

// разумные дефолты (можно подкрутить позже)
export const defaultSyncPolicy: SyncPolicy = {
  sales: { 
    priorityDays: 30, 
    refreshOverlapDays: 3, 
    catchupChunkDays: 30, 
    maxHistoryDays: 365, 
    refreshEveryMinutes: 30,
    backfillEnabled: true,
    backfillChunkDays: 7,
    backfillLowerBound: '2024-01-29',
  },
  returns: { priorityDays: 30, refreshOverlapDays: 3, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 30 },
  logistics: { priorityDays: 30, refreshOverlapDays: 7, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 60 },
  penalties: { priorityDays: 30, refreshOverlapDays: 7, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 60 },
  advCosts: { priorityDays: 30, refreshOverlapDays: 7, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 60 },
  storageCosts: { priorityDays: 30, refreshOverlapDays: 7, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 120 },
  acceptanceCosts: { priorityDays: 30, refreshOverlapDays: 7, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 120 },
  productOrders: { priorityDays: 30, refreshOverlapDays: 3, catchupChunkDays: 30, maxHistoryDays: 365, refreshEveryMinutes: 30 },
  supplies: { priorityDays: 90, refreshOverlapDays: 14, catchupChunkDays: 90, maxHistoryDays: 730, refreshEveryMinutes: 180 },
}
