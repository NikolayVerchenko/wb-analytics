import { DatabaseRepository } from '../../infrastructure/repositories/DatabaseRepository'
import { PurchaseRepository } from '../../infrastructure/repositories/PurchaseRepository'
import { WBApiClient } from '../../infrastructure/api/wbApiClient'
import { LocalStorageAdapter } from '../../infrastructure/adapters/LocalStorageAdapter'
import { DataLoadingService } from '../../application/services/DataLoadingService'
import { ReportAggregationService } from '../../application/services/ReportAggregationService'
import { SupplyService } from '../../application/services/SupplyService'
import { PurchaseService } from '../../application/purchases/PurchaseService'
import { PurchaseCalculator } from '../../application/purchases/PurchaseCalculator'
import { ProductCardPrefillService } from '../../application/purchases/ProductCardPrefillService'
import { db } from '../../db/db'
import axios from 'axios'
import type { useAnalyticsStore } from '../../stores/analyticsStore'

export class ServiceFactory {
  static createDataLoadingService(): DataLoadingService {
    const repository = new DatabaseRepository(db)
    return new DataLoadingService(repository)
  }

  static createReportAggregationService(): ReportAggregationService {
    const repository = new DatabaseRepository(db)
    return new ReportAggregationService(repository)
  }

  static createPurchaseService(): PurchaseService {
    const purchaseRepository = new PurchaseRepository(db)
    const purchaseCalculator = new PurchaseCalculator()
    const prefillService = new ProductCardPrefillService()
    return new PurchaseService(purchaseRepository, purchaseCalculator, prefillService)
  }

  static createSupplyService(): SupplyService {
    const repository = new DatabaseRepository(db)
    const purchaseRepository = new PurchaseRepository(db)
    const purchaseCalculator = new PurchaseCalculator()
    const storage = new LocalStorageAdapter()
    const apiKey = storage.getItem('wb_api_key') || ''
    const axiosInstance = axios.create()
    const apiClient = new WBApiClient(axiosInstance, apiKey)
    return new SupplyService(apiClient, repository, purchaseRepository, purchaseCalculator)
  }

  static initializeStore(store: ReturnType<typeof useAnalyticsStore>) {
    store.initializeServices(
      this.createDataLoadingService(),
      this.createReportAggregationService(),
      this.createSupplyService()
    )
  }
}
