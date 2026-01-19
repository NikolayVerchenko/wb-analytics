import type { IDatabaseRepository } from '../../core/domain/repositories/IDatabaseRepository'
import type { ProductAggregate } from '../../types/analytics'
import { ReportService } from '../../services/ReportService'

export class ReportAggregationService {
  constructor(private repository: IDatabaseRepository) {}

  async aggregateReport(params: {
    dateFrom: string
    dateTo: string
    globalTaxRate: number
  }): Promise<ProductAggregate[]> {
    // Загружаем данные через repository
    const [
      sales,
      returns,
      logistics,
      penalties,
      storageCosts,
      productOrders,
      advCosts,
      productCards,
      unitCosts,
      warehouseRemains,
      supplies,
    ] = await Promise.all([
      this.repository.getAllSales(), // Все продажи для агрегации
      this.repository.getReturns(params.dateFrom, params.dateTo),
      this.repository.getLogistics(params.dateFrom, params.dateTo),
      this.repository.getPenalties(params.dateFrom, params.dateTo),
      this.repository.getStorageCosts(params.dateFrom, params.dateTo),
      this.repository.getProductOrders(params.dateFrom, params.dateTo),
      this.repository.getAdvCosts(params.dateFrom, params.dateTo),
      this.repository.getProductCards(),
      this.repository.getUnitCosts(),
      this.repository.getWarehouseRemains(),
      this.repository.getSupplies(),
    ])

    // Используем логику из ReportService (можно вынести в отдельный класс)
    return ReportService.aggregate({
      ...params,
      sales,
      returns,
      logistics,
      penalties,
      storageCosts,
      productOrders,
      advCosts,
      productCards,
      unitCosts,
      warehouseRemains,
      supplies,
    })
  }
}
