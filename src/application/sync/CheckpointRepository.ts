import type { Checkpoint } from './types'

/**
 * Репозиторий для хранения и получения чекпоинтов синхронизации
 * 
 * Checkpoint обновляется ТОЛЬКО после успешного применения данных в БД.
 * Это гарантирует, что при повторной синхронизации не будет пропусков данных.
 */
export interface CheckpointRepository {
  /**
   * Получить чекпоинт для указанного ключа
   * @param key Ключ checkpoint (может быть DatasetKey или специальный ключ, например 'sales_backfill')
   * @returns Checkpoint или null, если чекпоинт не существует
   */
  get(key: string): Promise<Checkpoint | null>

  /**
   * Сохранить или обновить чекпоинт
   * @param checkpoint Checkpoint для сохранения
   */
  upsert(checkpoint: Checkpoint): Promise<void>
}
