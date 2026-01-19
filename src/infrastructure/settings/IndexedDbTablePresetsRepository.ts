import { db } from '../../db/db'
import type { ITablePresetsRepository, TableColumnsPreset, TableId } from '../../types/tablePresets'

/**
 * Реализация репозитория пресетов колонок через IndexedDB (Dexie)
 */
export class IndexedDbTablePresetsRepository implements ITablePresetsRepository {
  /**
   * Получить список всех пресетов для таблицы
   * Сортировка: встроенные первыми (isBuiltIn desc), затем по имени (name asc)
   */
  async list(tableId: TableId): Promise<TableColumnsPreset[]> {
    try {
      const presets = await db.table_presets
        .where('tableId')
        .equals(tableId)
        .toArray()

      // Сортировка: встроенные первыми, затем по имени
      return presets.sort((a, b) => {
        // Сначала встроенные (isBuiltIn desc)
        if (a.isBuiltIn && !b.isBuiltIn) return -1
        if (!a.isBuiltIn && b.isBuiltIn) return 1
        // Затем по имени (name asc)
        return a.name.localeCompare(b.name, 'ru')
      })
    } catch (error) {
      console.error('[IndexedDbTablePresetsRepository] Error listing presets:', error)
      throw error
    }
  }

  /**
   * Получить пресет по идентификатору
   */
  async get(tableId: TableId, id: string): Promise<TableColumnsPreset | null> {
    try {
      const preset = await db.table_presets.get(id)
      
      if (!preset || preset.tableId !== tableId) {
        return null
      }
      
      return preset
    } catch (error) {
      console.error('[IndexedDbTablePresetsRepository] Error getting preset:', error)
      throw error
    }
  }

  /**
   * Сохранить или обновить пресет
   */
  async upsert(preset: TableColumnsPreset): Promise<void> {
    try {
      // Проверка уникальности имени в рамках tableId (только для не-встроенных пресетов)
      if (!preset.isBuiltIn) {
        const existing = await db.table_presets
          .where('[tableId+name]')
          .equals([preset.tableId, preset.name])
          .and((p) => p.id !== preset.id)
          .first()

        if (existing) {
          throw new Error(`Пресет с именем "${preset.name}" уже существует`)
        }
      }

      // Создаем простой объект с сериализованными массивами для IndexedDB
      // Это гарантирует, что Proxy объекты от Vue будут преобразованы в обычные массивы
      const serializedPreset: TableColumnsPreset = {
        ...preset,
        visibleColumnIds: Array.from(preset.visibleColumnIds),
        columnOrder: Array.from(preset.columnOrder),
      }

      await db.table_presets.put(serializedPreset)
    } catch (error) {
      console.error('[IndexedDbTablePresetsRepository] Error upserting preset:', error)
      throw error
    }
  }

  /**
   * Удалить пресет
   * Встроенные пресеты удалять нельзя
   */
  async delete(tableId: TableId, id: string): Promise<void> {
    try {
      const preset = await db.table_presets.get(id)
      
      if (!preset || preset.tableId !== tableId) {
        throw new Error(`Пресет с id "${id}" не найден`)
      }

      if (preset.isBuiltIn) {
        throw new Error('Нельзя удалить встроенный пресет')
      }

      await db.table_presets.delete(id)
    } catch (error) {
      console.error('[IndexedDbTablePresetsRepository] Error deleting preset:', error)
      throw error
    }
  }

  /**
   * Убедиться, что встроенные пресеты созданы (seed)
   * Использует стабильные id для предотвращения дубликатов
   */
  async ensureSeeded(
    tableId: TableId,
    presets: Omit<TableColumnsPreset, 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    try {
      // Проверяем, есть ли уже встроенные пресеты для этой таблицы
      const allPresets = await db.table_presets
        .where('tableId')
        .equals(tableId)
        .toArray()
      const existingBuiltIns = allPresets.filter((p) => p.isBuiltIn)

      const existingIds = new Set(existingBuiltIns.map((p) => p.id))

      // Создаем только те, которых еще нет
      const now = new Date().toISOString()
      const toCreate = presets
        .filter((p) => !existingIds.has(p.id))
        .map((p) => ({
          ...p,
          createdAt: now,
          updatedAt: now,
        }))

      if (toCreate.length > 0) {
        await db.table_presets.bulkPut(toCreate)
      }
    } catch (error) {
      console.error('[IndexedDbTablePresetsRepository] Error seeding presets:', error)
      throw error
    }
  }
}
