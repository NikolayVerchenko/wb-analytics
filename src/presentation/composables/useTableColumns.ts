import { ref, computed, onMounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { ITableSettingsRepository } from '../../infrastructure/settings/ITableSettingsRepository'
import type { ColumnDef } from '../summary/summaryColumns'

export type ColumnId = string

/**
 * Composable для управления видимостью колонок таблицы
 */
export function useTableColumns<TData, TTotals>(
  allColumns: ColumnDef<TData, TTotals>[],
  repository: ITableSettingsRepository,
  storageKey: string
) {
  // Источник истины: порядок ВСЕХ колонок (включая скрытые)
  const columnOrder = ref<ColumnId[]>([])
  // Видимые колонки
  const visibleColumnIds = ref<ColumnId[]>([])
  const isLoading = ref(true)

  // Map для быстрого доступа к колонкам по ID
  const columnById = computed(() => {
    const map = new Map<ColumnId, ColumnDef<TData, TTotals>>()
    allColumns.forEach(col => map.set(col.id, col))
    return map
  })

  /**
   * Получает видимые колонки по умолчанию
   */
  const getDefaultVisibleIds = (): ColumnId[] => {
    return allColumns.filter(col => col.defaultVisible).map(col => col.id)
  }

  /**
   * Получает порядок колонок по умолчанию
   */
  const getDefaultOrder = (): ColumnId[] => {
    return allColumns.map(col => col.id)
  }

  /**
   * Загружает настройки из репозитория
   */
  const loadSettings = async () => {
    try {
      isLoading.value = true
      const settings = await repository.load(storageKey)

      if (settings) {
        // Валидация: проверяем, что все ID существуют
        const validVisibleIds = settings.visibleColumnIds.filter(id =>
          allColumns.some(col => col.id === id)
        )
        
        // Загружаем порядок колонок
        let loadedOrder: ColumnId[] = []
        if (settings.columnOrder && settings.columnOrder.length > 0) {
          // Удаляем несуществующие ID из порядка (миграция)
          const validOrderIds = settings.columnOrder.filter(id =>
            allColumns.some(col => col.id === id)
          )
          
          // Добавляем новые колонки в конец (не ломаем существующий порядок)
          const orderSet = new Set(validOrderIds)
          const newColumns = allColumns
            .filter(col => !orderSet.has(col.id))
            .map(col => col.id)
          
          loadedOrder = [...validOrderIds, ...newColumns]
        } else {
          // Если order не загружен, используем порядок по умолчанию
          loadedOrder = getDefaultOrder()
        }

        // Устанавливаем порядок
        columnOrder.value = loadedOrder

        // Устанавливаем видимые колонки
        // Добавляем недостающие видимые колонки (новые колонки с defaultVisible=true)
        const existingVisibleIds = new Set(validVisibleIds)
        const missingVisibleIds = allColumns
          .filter(col => col.defaultVisible && !existingVisibleIds.has(col.id))
          .map(col => col.id)

        visibleColumnIds.value = [...validVisibleIds, ...missingVisibleIds]
      } else {
        // Нет сохраненных настроек - используем значения по умолчанию
        columnOrder.value = getDefaultOrder()
        visibleColumnIds.value = getDefaultVisibleIds()
      }
    } catch (error) {
      console.error('[useTableColumns] Error loading settings:', error)
      columnOrder.value = getDefaultOrder()
      visibleColumnIds.value = getDefaultVisibleIds()
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Сохраняет настройки в репозиторий
   */
  const saveSettings = async () => {
    try {
      await repository.save(storageKey, {
        visibleColumnIds: visibleColumnIds.value,
        columnOrder: columnOrder.value,
      })
    } catch (error) {
      console.error('[useTableColumns] Error saving settings:', error)
    }
  }

  /**
   * Вычисляемые видимые колонки
   * Источник истины: columnOrder, фильтруем по visibleColumnIds
   */
  const visibleColumns = computed<ColumnDef<TData, TTotals>[]>(() => {
    const visibleSet = new Set(visibleColumnIds.value)
    return columnOrder.value
      .filter(id => visibleSet.has(id))
      .map(id => columnById.value.get(id))
      .filter((col): col is ColumnDef<TData, TTotals> => col !== undefined)
  })

  /**
   * Переключает видимость колонки
   * При показе колонка появляется в своём месте по columnOrder
   */
  const toggleColumn = (columnId: ColumnId) => {
    const index = visibleColumnIds.value.indexOf(columnId)
    if (index > -1) {
      // Скрываем колонку
      visibleColumnIds.value = visibleColumnIds.value.filter(id => id !== columnId)
    } else {
      // Показываем колонку - она уже есть в columnOrder, просто добавляем в visibleColumnIds
      visibleColumnIds.value = [...visibleColumnIds.value, columnId]
    }
    saveSettings()
  }

  /**
   * Сбрасывает настройки к значениям по умолчанию
   */
  const resetToDefault = async () => {
    columnOrder.value = getDefaultOrder()
    visibleColumnIds.value = getDefaultVisibleIds()
    await saveSettings()
  }

  /**
   * Применяет список видимых колонок
   */
  const applyVisible = (ids: ColumnId[]) => {
    // Валидация: проверяем, что все ID существуют
    const validIds = ids.filter(id => allColumns.some(col => col.id === id))
    visibleColumnIds.value = validIds
    saveSettings()
  }

  /**
   * Устанавливает список видимых колонок (без автосохранения)
   */
  const setVisibleColumnIds = (ids: ColumnId[]) => {
    const validIds = ids.filter(id => allColumns.some(col => col.id === id))
    visibleColumnIds.value = validIds
  }

  /**
   * Устанавливает порядок колонок (ВСЕХ колонок, включая скрытые)
   * @param skipSave Если true, не сохраняет настройки в репозиторий (для временных изменений)
   */
  const setColumnOrder = async (order: ColumnId[], skipSave = false) => {
    // Валидация: проверяем, что все ID существуют
    const validIds = order.filter(id => allColumns.some(col => col.id === id))
    
    // Проверяем, содержит ли order все колонки
    const orderSet = new Set(validIds)
    const allColumnIds = new Set(allColumns.map(col => col.id))
    const hasAllColumns = validIds.length === allColumns.length && 
      validIds.every(id => allColumnIds.has(id)) &&
      allColumns.every(col => orderSet.has(col.id))
    
    if (hasAllColumns) {
      // Если order содержит все колонки, используем его как есть
      columnOrder.value = [...validIds]
    } else {
      // Добавляем недостающие колонки в конец (миграция)
      const missingColumns = allColumns
        .filter(col => !orderSet.has(col.id))
        .map(col => col.id)
      columnOrder.value = [...validIds, ...missingColumns]
    }
    
    if (!skipSave) {
      await saveSettings()
    }
  }

  /**
   * Перемещает колонку в порядке (drag&drop)
   * @param fromIndex Индекс исходной позиции в columnOrder
   * @param toIndex Индекс целевой позиции в columnOrder
   */
  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    const newOrder = [...columnOrder.value]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    
    columnOrder.value = newOrder
    saveSettings()
  }

  /**
   * Перемещает колонку по ID (удобнее для drag&drop)
   * @param columnId ID колонки для перемещения
   * @param targetColumnId ID колонки-цели
   * @param position Позиция относительно цели: 'before' или 'after'
   */
  const moveColumnById = (columnId: ColumnId, targetColumnId: ColumnId, position: 'before' | 'after' = 'before') => {
    const fromIndex = columnOrder.value.indexOf(columnId)
    const targetIndex = columnOrder.value.indexOf(targetColumnId)
    
    if (fromIndex === -1 || targetIndex === -1) return
    if (fromIndex === targetIndex) return // Не перемещаем элемент на свою позицию
    
    // Создаем новый массив для перемещения
    const newOrder = [...columnOrder.value]
    
    // Удаляем элемент из исходной позиции
    const [movedItem] = newOrder.splice(fromIndex, 1)
    
    // Вычисляем целевую позицию с учетом того, что элемент уже удален
    let toIndex: number
    
    if (position === 'before') {
      // Вставляем перед целевой колонкой
      if (fromIndex < targetIndex) {
        // Перемещаем вправо: индекс цели уменьшился на 1 после удаления
        toIndex = targetIndex - 1
      } else {
        // Перемещаем влево: индекс цели не изменился
        toIndex = targetIndex
      }
    } else {
      // Вставляем после целевой колонки
      if (fromIndex < targetIndex) {
        // Перемещаем вправо: индекс цели уменьшился на 1 после удаления
        toIndex = targetIndex
      } else {
        // Перемещаем влево: индекс цели не изменился
        toIndex = targetIndex + 1
      }
    }
    
    // Вставляем элемент в новую позицию
    newOrder.splice(toIndex, 0, movedItem)
    
    columnOrder.value = newOrder
    saveSettings()
  }

  // Загружаем настройки при монтировании
  onMounted(() => {
    loadSettings()
  })

  return {
    visibleColumnIds: visibleColumnIds as Ref<ColumnId[]>,
    columnOrder: columnOrder as Ref<ColumnId[]>,
    visibleColumns,
    isLoading: isLoading as Ref<boolean>,
    toggleColumn,
    resetToDefault,
    applyVisible,
    setVisibleColumnIds,
    setColumnOrder,
    moveColumn,
    moveColumnById,
    reload: loadSettings,
  }
}
