/**
 * Настройки таблицы (видимые колонки и их порядок)
 */
export interface TableSettings {
  /** Список ID видимых колонок */
  visibleColumnIds: string[]
  /** Порядок колонок (список ID) */
  columnOrder: string[]
}

/**
 * Репозиторий для хранения настроек таблицы
 */
export interface ITableSettingsRepository {
  /**
   * Загружает настройки таблицы по ключу
   * @param key Ключ для сохранения настроек (например, 'summaryTable:v1')
   * @returns Настройки или null, если не найдены
   */
  load(key: string): Promise<TableSettings | null>

  /**
   * Сохраняет настройки таблицы
   * @param key Ключ для сохранения настроек
   * @param settings Настройки для сохранения
   */
  save(key: string, settings: TableSettings): Promise<void>

  /**
   * Удаляет настройки таблицы
   * @param key Ключ для удаления
   */
  clear(key: string): Promise<void>
}
