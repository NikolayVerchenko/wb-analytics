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
    try {
      // Очищаем старые данные (опционально, можно сделать через параметр)
      // await this.clearDatabase()

      // Загружаем данные с API
      const items = await this.fetchFromApi(options)
      
      if (options.onProgress) {
        options.onProgress(items.length, items.length)
      }

      // Сохраняем в базу данных
      await this.saveToDatabase(items)
    } catch (error) {
      console.error(`Error syncing ${this.constructor.name}:`, error)
      throw error
    }
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}
