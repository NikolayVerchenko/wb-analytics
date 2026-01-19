import type { IDatabaseRepository } from '../../core/domain/repositories/IDatabaseRepository'

export class DataLoadingService {
  constructor(private repository: IDatabaseRepository) {}

  async loadPriorityData(dateFrom: string, dateTo: string): Promise<{
    sales: any[]
    returns: any[]
    logistics: any[]
    penalties: any[]
    deductions: any[]
    advCosts: any[]
    storageCosts: any[]
    acceptanceCosts: any[]
    productOrders: any[]
    productCards: any[]
    unitCosts: any[]
  }> {
    // Загружаем данные за указанный период параллельно
    const [
      sales,
      returns,
      logistics,
      penalties,
      deductions,
      advCosts,
      storageCosts,
      acceptanceCosts,
      productOrders,
      productCards,
      unitCosts,
    ] = await Promise.all([
      // Финансовые таблицы
      this.repository.getSales(dateFrom, dateTo),
      this.repository.getReturns(dateFrom, dateTo),
      this.repository.getLogistics(dateFrom, dateTo),
      this.repository.getPenalties(dateFrom, dateTo),
      // TODO: deductions - need to check if this exists in repository
      Promise.resolve([]), // Placeholder for deductions
      // Таблицы затрат
      this.repository.getAdvCosts(dateFrom, dateTo),
      this.repository.getStorageCosts(dateFrom, dateTo),
      this.repository.getAcceptanceCosts(dateFrom, dateTo),
      // Статистика заказов
      this.repository.getProductOrders(dateFrom, dateTo),
      // Справочники (загружаем полностью)
      this.repository.getProductCards(),
      this.repository.getUnitCosts(),
    ])

    return {
      sales,
      returns,
      logistics,
      penalties,
      deductions,
      advCosts,
      storageCosts,
      acceptanceCosts,
      productOrders,
      productCards,
      unitCosts,
    }
  }

  async loadHistoryData(dateFrom: string, dateTo: string): Promise<{
    sales: any[]
    returns: any[]
    logistics: any[]
    penalties: any[]
    deductions: any[]
    advCosts: any[]
    storageCosts: any[]
    acceptanceCosts: any[]
    productOrders: any[]
  }> {
    // Загружаем исторические данные параллельно
    const [
      sales,
      returns,
      logistics,
      penalties,
      deductions,
      advCosts,
      storageCosts,
      acceptanceCosts,
      productOrders,
    ] = await Promise.all([
      this.repository.getSales(dateFrom, dateTo),
      this.repository.getReturns(dateFrom, dateTo),
      this.repository.getLogistics(dateFrom, dateTo),
      this.repository.getPenalties(dateFrom, dateTo),
      // TODO: deductions - need to check if this exists in repository
      Promise.resolve([]), // Placeholder for deductions
      this.repository.getAdvCosts(dateFrom, dateTo),
      this.repository.getStorageCosts(dateFrom, dateTo),
      this.repository.getAcceptanceCosts(dateFrom, dateTo),
      this.repository.getProductOrders(dateFrom, dateTo),
    ])

    return {
      sales,
      returns,
      logistics,
      penalties,
      deductions,
      advCosts,
      storageCosts,
      acceptanceCosts,
      productOrders,
    }
  }

  async loadCatalogData(): Promise<{
    productCards: any[]
    unitCosts: any[]
    warehouseRemains: any[]
    supplies: any[]
  }> {
    const [
      productCards,
      unitCosts,
      warehouseRemains,
      supplies,
    ] = await Promise.all([
      this.repository.getProductCards(),
      this.repository.getUnitCosts(),
      this.repository.getWarehouseRemains(),
      this.repository.getSupplies(),
    ])

    return {
      productCards,
      unitCosts,
      warehouseRemains,
      supplies,
    }
  }

  async getGlobalTaxRate(): Promise<number> {
    const taxSetting = await this.repository.getSetting('global_tax')
    return taxSetting ? parseFloat(taxSetting.value) || 6 : 6
  }

  async saveGlobalTaxRate(taxRate: number): Promise<void> {
    await this.repository.saveSetting('global_tax', taxRate.toString())
  }
}
