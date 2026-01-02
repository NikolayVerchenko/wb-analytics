import type { WBApiClient } from '../api/wbApiClient'

export interface SyncOptions {
  dateFrom: string
  dateTo?: string
  onProgress?: (progress: number, total: number) => void
}

export abstract class BaseSyncService<T> {
  protected apiClient: WBApiClient

  constructor(apiClient: WBApiClient) {
    this.apiClient = apiClient
  }

  abstract fetchFromApi(options: SyncOptions): Promise<T[]>
  abstract saveToDatabase(items: T[]): Promise<void>
  abstract clearDatabase(): Promise<void>

  async sync(options: SyncOptions): Promise<void> {
    console.log(`🔄 [BaseSyncService] sync вызван для ${this.constructor.name}`)
    try {
      // Очищаем старые данные (опционально, можно сделать через параметр)
      // await this.clearDatabase()

      // Загружаем данные с API
      console.log(`📥 [BaseSyncService] Загрузка данных с API...`)
      const items = await this.fetchFromApi(options)
      console.log(`📦 [BaseSyncService] Загружено ${items.length} записей с API`)
      
      if (options.onProgress) {
        options.onProgress(items.length, items.length)
      }

      // Сохраняем в базу данных
      console.log(`💾 [BaseSyncService] Сохранение в базу данных...`)
      await this.saveToDatabase(items)
      console.log(`✅ [BaseSyncService] Синхронизация завершена для ${this.constructor.name}`)
    } catch (error) {
      console.error(`❌ [BaseSyncService] Ошибка синхронизации ${this.constructor.name}:`, error)
      throw error
    }
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}
