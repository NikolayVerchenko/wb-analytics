export type SyncType = 'daily' | 'weekly'
export type SyncStatus = 'pending' | 'waiting' | 'success' | 'failed'

export interface SyncRegistryEntry {
  id?: number
  periodId: string // Формат: "YYYY-WNN" для недель, "YYYY-MM-DD" для дней
  type: SyncType // 'daily' или 'weekly'
  status: SyncStatus // 'pending', 'waiting', 'success', 'failed'
  lastAttempt: number // Timestamp последней попытки
  nextRetryAt?: number // Timestamp следующей попытки (для waiting статуса)
  isFinal: boolean // true если период полностью закрыт (только для weekly)
  errorMessage?: string // Сообщение об ошибке (если status = 'failed')
  createdAt: number // Timestamp создания записи
  updatedAt: number // Timestamp последнего обновления
}