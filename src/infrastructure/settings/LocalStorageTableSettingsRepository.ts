import type { ITableSettingsRepository, TableSettings } from './ITableSettingsRepository'

/**
 * Реализация репозитория настроек таблицы через localStorage
 */
export class LocalStorageTableSettingsRepository implements ITableSettingsRepository {
  private readonly prefix = 'tableSettings:'

  /**
   * Получает ключ для localStorage
   */
  private getStorageKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async load(key: string): Promise<TableSettings | null> {
    try {
      const storageKey = this.getStorageKey(key)
      const stored = localStorage.getItem(storageKey)
      
      if (!stored) {
        return null
      }

      const settings = JSON.parse(stored) as TableSettings

      // Валидация структуры
      if (!settings.visibleColumnIds || !Array.isArray(settings.visibleColumnIds)) {
        console.warn(`[LocalStorageTableSettingsRepository] Invalid visibleColumnIds for key ${key}`)
        return null
      }

      if (!settings.columnOrder || !Array.isArray(settings.columnOrder)) {
        console.warn(`[LocalStorageTableSettingsRepository] Invalid columnOrder for key ${key}`)
        return null
      }

      return settings
    } catch (error) {
      console.error(`[LocalStorageTableSettingsRepository] Error loading settings for key ${key}:`, error)
      return null
    }
  }

  async save(key: string, settings: TableSettings): Promise<void> {
    try {
      const storageKey = this.getStorageKey(key)
      const serialized = JSON.stringify(settings)
      localStorage.setItem(storageKey, serialized)
    } catch (error) {
      console.error(`[LocalStorageTableSettingsRepository] Error saving settings for key ${key}:`, error)
      throw error
    }
  }

  async clear(key: string): Promise<void> {
    try {
      const storageKey = this.getStorageKey(key)
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error(`[LocalStorageTableSettingsRepository] Error clearing settings for key ${key}:`, error)
      throw error
    }
  }
}
