import { ref, computed, onBeforeUnmount } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { db } from '../../db/db'
import type { TableColumnsPreset, TableId, ColumnId } from '../../types/tablePresets'
import type { TablePresetsService } from '../../application/table/TablePresetsService'

/**
 * API для управления колонками таблицы (из useTableColumns)
 */
export interface TableColumnsApi {
  visibleColumnIds: Ref<ColumnId[]>
  columnOrder?: Ref<ColumnId[]>
  setVisibleColumnIds(ids: ColumnId[]): void
  setColumnOrder?(ids: ColumnId[], skipSave?: boolean): Promise<void>
}

/**
 * Composable для управления пресетами колонок таблицы
 */
export function useTableColumnPresets(
  tableId: TableId,
  tableColumnsApi: TableColumnsApi,
  service: TablePresetsService
) {
  const presets = ref<TableColumnsPreset[]>([])
  const activePresetId = ref<string | null>(null)
  const isLoading = ref(true)

  /**
   * Активный пресет (computed)
   */
  const activePreset = computed<TableColumnsPreset | null>(() => {
    if (!activePresetId.value) return null
    return presets.value.find((p) => p.id === activePresetId.value) || null
  })

  /**
   * Проверка, изменена ли конфигурация относительно активного пресета (isDirty)
   * Учитывает изменения как видимости, так и порядка колонок
   */
  const isDirty = computed<boolean>(() => {
    if (!activePreset.value) return false

    const currentVisibleIds = tableColumnsApi.visibleColumnIds.value
    const presetVisibleIds = activePreset.value.visibleColumnIds

    // Сравниваем видимые колонки (множества)
    const currentVisibleSet = new Set(currentVisibleIds)
    const presetVisibleSet = new Set(presetVisibleIds)

    if (currentVisibleSet.size !== presetVisibleSet.size) return true

    for (const id of currentVisibleSet) {
      if (!presetVisibleSet.has(id)) return true
    }

    // Сравниваем порядок колонок
    const currentOrder = tableColumnsApi.columnOrder?.value || []
    const presetOrder = activePreset.value.columnOrder || []

    if (currentOrder.length !== presetOrder.length) return true

    // Проверяем порядок видимых колонок
    const currentVisibleOrder = currentOrder.filter(id => currentVisibleSet.has(id))
    const presetVisibleOrder = presetOrder.filter(id => presetVisibleSet.has(id))

    if (currentVisibleOrder.length !== presetVisibleOrder.length) return true

    for (let i = 0; i < currentVisibleOrder.length; i++) {
      if (currentVisibleOrder[i] !== presetVisibleOrder[i]) return true
    }

    return false
  })

  /**
   * Загрузить активный пресет из IndexedDB
   */
  const loadActivePresetId = async (): Promise<string | null> => {
    try {
      const setting = await db.settings.get(`${tableId}.activePresetId`)
      return setting?.value || null
    } catch (error) {
      console.error('[useTableColumnPresets] Error loading active preset ID:', error)
      return null
    }
  }

  /**
   * Сохранить активный пресет в IndexedDB
   */
  const saveActivePresetId = async (presetId: string | null): Promise<void> => {
    try {
      if (presetId) {
        await db.settings.put({
          key: `${tableId}.activePresetId`,
          value: presetId,
        })
      } else {
        await db.settings.delete(`${tableId}.activePresetId`)
      }
    } catch (error) {
      console.error('[useTableColumnPresets] Error saving active preset ID:', error)
    }
  }

  /**
   * Инициализация: загрузка пресетов и применение активного
   */
  const init = async (): Promise<void> => {
    try {
      isLoading.value = true

      // Инициализируем встроенные пресеты
      await service.initSummaryPresets()

      // Загружаем список пресетов
      presets.value = await service.list(tableId)

      // Загружаем активный пресет
      const savedActiveId = await loadActivePresetId()
      
      if (savedActiveId) {
        const preset = presets.value.find((p) => p.id === savedActiveId) || null
        const shouldForceAll = preset?.isBuiltIn && preset.id !== 'summary:all'
        const targetId = shouldForceAll
          ? (presets.value.find((p) => p.id === 'summary:all')?.id || savedActiveId)
          : savedActiveId

        if (presets.value.some((p) => p.id === targetId)) {
          activePresetId.value = targetId
          // При инициализации не перезаписываем localStorage, если там уже есть настройки
          // Пользователь мог изменить порядок и сохранить его
          await applyPreset(targetId, false, true)
          if (shouldForceAll && targetId !== savedActiveId) {
            await saveActivePresetId(targetId)
          }
        } else {
          const builtIn = presets.value.find((p) => p.id === 'summary:all') || presets.value.find((p) => p.isBuiltIn)
          if (builtIn) {
            activePresetId.value = builtIn.id
            await applyPreset(builtIn.id, false, true)
            await saveActivePresetId(builtIn.id)
          }
        }
      } else {
        const builtIn = presets.value.find((p) => p.id === 'summary:all') || presets.value.find((p) => p.isBuiltIn)
        if (builtIn) {
          activePresetId.value = builtIn.id
          await applyPreset(builtIn.id, false, true)
          await saveActivePresetId(builtIn.id)
        }
      }
    } catch (error) {
      console.error('[useTableColumnPresets] Error initializing presets:', error)
      // В случае ошибки применяем первый встроенный пресет
      const builtIn = presets.value.find((p) => p.id === 'summary:all') || presets.value.find((p) => p.isBuiltIn)
      if (builtIn) {
        activePresetId.value = builtIn.id
        await applyPreset(builtIn.id, false, true)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Применить пресет
   * @param skipSaveId Если true, не сохраняет activePresetId (для внутреннего использования)
   * @param skipSaveToLocalStorage Если true, не сохраняет настройки в localStorage (для применения пресета при инициализации)
   */
  const applyPreset = async (presetId: string, skipSaveId = false, skipSaveToLocalStorage = false): Promise<void> => {
    try {
      const config = await service.apply(tableId, presetId)
      
      // Применяем порядок колонок (источник истины)
      if (config.columnOrder && tableColumnsApi.setColumnOrder) {
        await tableColumnsApi.setColumnOrder(config.columnOrder, skipSaveToLocalStorage)
      }
      
      // Применяем видимые колонки
      tableColumnsApi.setVisibleColumnIds(config.visibleColumnIds)

      activePresetId.value = presetId
      
      if (!skipSaveId) {
        await saveActivePresetId(presetId)
      }
    } catch (error) {
      console.error('[useTableColumnPresets] Error applying preset:', error)
      throw error
    }
  }

  /**
   * Сохранить текущую конфигурацию в активный пресет
   */
  const saveActive = async (): Promise<void> => {
    if (!activePresetId.value || !activePreset.value) {
      throw new Error('Нет активного пресета')
    }

    if (activePreset.value.isBuiltIn) {
      throw new Error('Нельзя перезаписать встроенный пресет')
    }

    const config = {
      visibleColumnIds: tableColumnsApi.visibleColumnIds.value,
      columnOrder: tableColumnsApi.columnOrder?.value || [],
    }

    await service.saveActive(tableId, activePresetId.value, config)

    // Обновляем локальный список пресетов
    presets.value = await service.list(tableId)
  }

  /**
   * Сохранить текущую конфигурацию как новый пресет
   */
  const saveAs = async (name: string): Promise<void> => {
    const config = {
      visibleColumnIds: tableColumnsApi.visibleColumnIds.value,
      columnOrder: tableColumnsApi.columnOrder?.value || [],
    }

    const newPreset = await service.saveAs(tableId, name, config)

    // Обновляем локальный список пресетов
    presets.value = await service.list(tableId)

    // Делаем новый пресет активным
    activePresetId.value = newPreset.id
    await saveActivePresetId(newPreset.id)
  }

  /**
   * Переименовать пресет
   */
  const renamePreset = async (presetId: string, name: string): Promise<void> => {
    await service.rename(tableId, presetId, name)

    // Обновляем локальный список пресетов
    presets.value = await service.list(tableId)
  }

  /**
   * Удалить пресет
   */
  const deletePreset = async (presetId: string): Promise<void> => {
    await service.remove(tableId, presetId)

    // Обновляем локальный список пресетов
    presets.value = await service.list(tableId)

    // Если удалили активный пресет, переключаемся на первый встроенный
    if (activePresetId.value === presetId) {
      const builtIn = presets.value.find((p) => p.isBuiltIn)
      if (builtIn) {
        activePresetId.value = builtIn.id
        await applyPreset(builtIn.id)
        await saveActivePresetId(builtIn.id)
      } else {
        activePresetId.value = null
        await saveActivePresetId(null)
      }
    }
  }

  /**
   * Перезагрузить список пресетов
   */
  const reload = async (): Promise<void> => {
    presets.value = await service.list(tableId)
  }

  return {
    presets: presets as Ref<TableColumnsPreset[]>,
    activePresetId: activePresetId as Ref<string | null>,
    activePreset,
    isDirty,
    isLoading: isLoading as Ref<boolean>,
    init,
    applyPreset,
    saveActive,
    saveAs,
    renamePreset,
    deletePreset,
    reload,
  }
}
