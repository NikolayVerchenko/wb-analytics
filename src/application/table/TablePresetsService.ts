import type { ITablePresetsRepository, TableColumnsPreset, TableId, ColumnId } from '../../types/tablePresets'

/**
 * Сервис для работы с пресетами колонок таблиц
 */
export class TablePresetsService {
  constructor(private repo: ITablePresetsRepository) {}

  /**
   * Инициализировать встроенные пресеты для таблицы Summary
   */
  async initSummaryPresets(): Promise<void> {
    const builtInPresets: Omit<TableColumnsPreset, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'summary:all',
        tableId: 'summaryTable',
        name: 'Все колонки',
        isBuiltIn: true,
        visibleColumnIds: [
          'product',
          'orders',
          'deliveries',
          'cancels',
          'returns',
          'sales',
          'netSales',
          'buyoutPercent',
          'netRevenue',
          'priceAfterNetRevenue',
          'revenueAfterSpp',
          'sppAmount',
          'sppPercent',
          'transferAmount',
          'commissionAmount',
          'commissionPercent',
          'logistics',
          'logisticsCostPerUnit',
          'storage',
          'advCosts',
          'advCostPerUnit',
          'drrSales',
          'drrOrders',
          'drrOrdersForecast',
          'taxes',
          'unitCosts',
          'unitCostPerItem',
          'profit',
          'marginPercent',
          'roiPercent',
        ],
        columnOrder: [
          'product',
          'orders',
          'deliveries',
          'cancels',
          'returns',
          'sales',
          'netSales',
          'buyoutPercent',
          'netRevenue',
          'priceAfterNetRevenue',
          'revenueAfterSpp',
          'sppAmount',
          'sppPercent',
          'transferAmount',
          'commissionAmount',
          'commissionPercent',
          'logistics',
          'logisticsCostPerUnit',
          'storage',
          'advCosts',
          'advCostPerUnit',
          'drrSales',
          'drrOrders',
          'drrOrdersForecast',
          'taxes',
          'unitCosts',
          'unitCostPerItem',
          'profit',
          'marginPercent',
          'roiPercent',
        ],
      },
      {
        id: 'summary:basic',
        tableId: 'summaryTable',
        name: 'Основные',
        isBuiltIn: true,
        visibleColumnIds: [
          'product',
          'orders',
          'netSales',
          'buyoutPercent',
          'profit',
          'marginPercent',
          'roiPercent',
        ],
        columnOrder: [
          'product',
          'orders',
          'netSales',
          'buyoutPercent',
          'profit',
          'marginPercent',
          'roiPercent',
        ],
      },
      {
        id: 'summary:finance',
        tableId: 'summaryTable',
        name: 'Финансы',
        isBuiltIn: true,
        visibleColumnIds: [
          'product',
          'netRevenue',
          'priceAfterNetRevenue',
          'revenueAfterSpp',
          'sppAmount',
          'sppPercent',
          'transferAmount',
          'commissionAmount',
          'commissionPercent',
          'taxes',
          'unitCosts',
          'unitCostPerItem',
          'profit',
          'marginPercent',
        ],
        columnOrder: [
          'product',
          'netRevenue',
          'priceAfterNetRevenue',
          'revenueAfterSpp',
          'sppAmount',
          'sppPercent',
          'transferAmount',
          'commissionAmount',
          'commissionPercent',
          'taxes',
          'unitCosts',
          'unitCostPerItem',
          'profit',
          'marginPercent',
        ],
      },
      {
        id: 'summary:ads',
        tableId: 'summaryTable',
        name: 'Реклама',
        isBuiltIn: true,
        visibleColumnIds: [
          'product',
          'advCosts',
          'advCostPerUnit',
          'drrSales',
          'drrOrders',
          'drrOrdersForecast',
          'profit',
          'roiPercent',
        ],
        columnOrder: [
          'product',
          'advCosts',
          'advCostPerUnit',
          'drrSales',
          'drrOrders',
          'drrOrdersForecast',
          'profit',
          'roiPercent',
        ],
      },
      {
        id: 'summary:logistics',
        tableId: 'summaryTable',
        name: 'Логистика',
        isBuiltIn: true,
        visibleColumnIds: [
          'product',
          'deliveries',
          'cancels',
          'returns',
          'logistics',
          'logisticsCostPerUnit',
          'storage',
          'profit',
        ],
        columnOrder: [
          'product',
          'deliveries',
          'cancels',
          'returns',
          'logistics',
          'logisticsCostPerUnit',
          'storage',
          'profit',
        ],
      },
    ]

    await this.repo.ensureSeeded('summaryTable', builtInPresets)
  }

  /**
   * Получить список пресетов для таблицы
   */
  async list(tableId: TableId): Promise<TableColumnsPreset[]> {
    return this.repo.list(tableId)
  }

  /**
   * Применить пресет (получить конфигурацию колонок)
   */
  async apply(
    tableId: TableId,
    presetId: string
  ): Promise<{ visibleColumnIds: ColumnId[]; columnOrder: ColumnId[] }> {
    const preset = await this.repo.get(tableId, presetId)
    
    if (!preset) {
      throw new Error(`Пресет "${presetId}" не найден`)
    }

    return {
      visibleColumnIds: preset.visibleColumnIds,
      columnOrder: preset.columnOrder,
    }
  }

  /**
   * Сохранить текущую конфигурацию в активный пресет (только если не builtIn)
   */
  async saveActive(
    tableId: TableId,
    presetId: string,
    config: { visibleColumnIds: ColumnId[]; columnOrder: ColumnId[] }
  ): Promise<void> {
    const preset = await this.repo.get(tableId, presetId)
    
    if (!preset) {
      throw new Error(`Пресет "${presetId}" не найден`)
    }

    if (preset.isBuiltIn) {
      throw new Error('Нельзя перезаписать встроенный пресет')
    }

    // Создаем простые массивы (не Proxy) для IndexedDB
    const updated: TableColumnsPreset = {
      ...preset,
      visibleColumnIds: Array.from(config.visibleColumnIds),
      columnOrder: Array.from(config.columnOrder),
      updatedAt: new Date().toISOString(),
    }

    await this.repo.upsert(updated)
  }

  /**
   * Сохранить текущую конфигурацию как новый пресет
   */
  async saveAs(
    tableId: TableId,
    name: string,
    config: { visibleColumnIds: ColumnId[]; columnOrder: ColumnId[] }
  ): Promise<TableColumnsPreset> {
    // Проверка уникальности имени
    const existing = await this.repo.list(tableId)
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()))

    let finalName = name
    let counter = 2

    while (existingNames.has(finalName.toLowerCase())) {
      finalName = `${name} (${counter})`
      counter++
    }

    const now = new Date().toISOString()
    // Создаем простые массивы (не Proxy) для IndexedDB
    const newPreset: TableColumnsPreset = {
      id: `preset:${tableId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      tableId,
      name: finalName,
      visibleColumnIds: Array.from(config.visibleColumnIds),
      columnOrder: Array.from(config.columnOrder),
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    }

    await this.repo.upsert(newPreset)
    return newPreset
  }

  /**
   * Переименовать пресет (только если не builtIn)
   */
  async rename(tableId: TableId, presetId: string, name: string): Promise<void> {
    const preset = await this.repo.get(tableId, presetId)
    
    if (!preset) {
      throw new Error(`Пресет "${presetId}" не найден`)
    }

    if (preset.isBuiltIn) {
      throw new Error('Нельзя переименовать встроенный пресет')
    }

    // Проверка уникальности имени
    const existing = await this.repo.list(tableId)
    const conflicting = existing.find((p) => p.id !== presetId && p.name.toLowerCase() === name.toLowerCase())

    if (conflicting) {
      throw new Error(`Пресет с именем "${name}" уже существует`)
    }

    const updated: TableColumnsPreset = {
      ...preset,
      name,
      updatedAt: new Date().toISOString(),
    }

    await this.repo.upsert(updated)
  }

  /**
   * Удалить пресет (только если не builtIn)
   */
  async remove(tableId: TableId, presetId: string): Promise<void> {
    await this.repo.delete(tableId, presetId)
  }
}
