/**
 * Идентификатор таблицы
 */
export type TableId = 'summaryTable'

/**
 * Идентификатор колонки (используется из системы колонок)
 */
export type ColumnId = string

/**
 * Пресет настроек колонок таблицы
 */
export interface TableColumnsPreset {
  /** Уникальный идентификатор пресета */
  id: string
  /** Идентификатор таблицы */
  tableId: TableId
  /** Название пресета */
  name: string
  /** Список видимых колонок */
  visibleColumnIds: ColumnId[]
  /** Порядок колонок (для будущей функциональности reorder) */
  columnOrder: ColumnId[]
  /** Встроенный пресет (нельзя удалять/переименовывать) */
  isBuiltIn: boolean
  /** Дата создания (ISO строка) */
  createdAt: string
  /** Дата обновления (ISO строка) */
  updatedAt: string
}

/**
 * Интерфейс репозитория пресетов колонок
 */
export interface ITablePresetsRepository {
  /**
   * Получить список всех пресетов для таблицы
   */
  list(tableId: TableId): Promise<TableColumnsPreset[]>

  /**
   * Получить пресет по идентификатору
   */
  get(tableId: TableId, id: string): Promise<TableColumnsPreset | null>

  /**
   * Сохранить или обновить пресет
   */
  upsert(preset: TableColumnsPreset): Promise<void>

  /**
   * Удалить пресет
   */
  delete(tableId: TableId, id: string): Promise<void>

  /**
   * Убедиться, что встроенные пресеты созданы (seed)
   */
  ensureSeeded(
    tableId: TableId,
    presets: Omit<TableColumnsPreset, 'createdAt' | 'updatedAt'>[]
  ): Promise<void>
}
