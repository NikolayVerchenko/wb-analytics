import { WBApiClient } from '@infrastructure/api/wbApiClient'
import { OrderRepository } from '@infrastructure/repositories/OrderRepository'
import { ExpenseRepository } from '@infrastructure/repositories/ExpenseRepository'
import { StorageRepository } from '@infrastructure/repositories/StorageRepository'
import { AcceptanceRepository } from '@infrastructure/repositories/AcceptanceRepository'
import { ProductRepository } from '@infrastructure/repositories/ProductRepository'
import { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'
import { SyncRegistryRepository } from '@infrastructure/repositories/SyncRegistryRepository'
import { OrderSyncService } from '@infrastructure/services/OrderSyncService'
import { ExpenseSyncService } from '@infrastructure/services/ExpenseSyncService'
import { ReportSyncServiceV2 } from '@application/services/ReportSyncServiceV2'
import { SyncCoordinator } from '@application/services/SyncCoordinator'
import { DataPersistenceService } from '@application/services/DataPersistenceService'
import { SummaryService } from '@application/services/SummaryService'
import { ProductService } from '@application/services/ProductService'
import { CategoryService } from '@core/services/CategoryService'
import { VendorCodeService } from '@core/services/VendorCodeService'
import { LoggerService, loggerService } from '@application/services/LoggerService'
import { DataAggregator } from '@infrastructure/aggregators/DataAggregator'
import { DatePeriodService } from '@core/services/DatePeriodService'
import { DateRangeService } from '@core/services/DateRangeService'
import { SyncDataUseCase } from '@application/use-cases/SyncDataUseCase'
import { CalculatePnLUseCase } from '@application/use-cases/CalculatePnLUseCase'
import { GetWeeklyAnalyticsUseCase } from '@application/use-cases/GetWeeklyAnalyticsUseCase'

export class DIContainer {
  private static instance: DIContainer
  private apiClient: WBApiClient | null = null

  // Repositories
  private orderRepository: OrderRepository | null = null
  private expenseRepository: ExpenseRepository | null = null
  private storageRepository: StorageRepository | null = null
  private acceptanceRepository: AcceptanceRepository | null = null
  private productRepository: ProductRepository | null = null
  private reportSaleRepository: ReportSaleRepository | null = null
  private reportReturnRepository: ReportReturnRepository | null = null
  private syncRegistryRepository: SyncRegistryRepository | null = null

  // Services & Utils
  private orderSyncService: OrderSyncService | null = null
  private expenseSyncService: ExpenseSyncService | null = null
  private reportSyncServiceV2: ReportSyncServiceV2 | null = null
  private syncCoordinator: SyncCoordinator | null = null
  private dataPersistenceService: DataPersistenceService | null = null
  private summaryService: SummaryService | null = null
  private productService: ProductService | null = null
  private categoryService: CategoryService | null = null
  private vendorCodeService: VendorCodeService | null = null
  private dataAggregator: DataAggregator | null = null
  private datePeriodService: DatePeriodService | null = null
  private dateRangeService: DateRangeService | null = null
  private loggerService: LoggerService | null = null

  // Use Cases
  private syncDataUseCase: SyncDataUseCase | null = null
  private calculatePnLUseCase: CalculatePnLUseCase | null = null
  private getWeeklyAnalyticsUseCase: GetWeeklyAnalyticsUseCase | null = null

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
  }

  initialize(apiKey: string): void {
    // API Client
    this.apiClient = new WBApiClient({ 
      apiKey, 
      logger: this.getLoggerService() 
    })

    // Repositories
    this.orderRepository = new OrderRepository()
    this.expenseRepository = new ExpenseRepository()
    this.storageRepository = new StorageRepository()
    this.acceptanceRepository = new AcceptanceRepository()
    this.productRepository = new ProductRepository()
    this.reportSaleRepository = new ReportSaleRepository()
    this.reportReturnRepository = new ReportReturnRepository()
    this.syncRegistryRepository = new SyncRegistryRepository()

    // Utils
    this.dataAggregator = new DataAggregator()
    this.datePeriodService = new DatePeriodService()
    this.dateRangeService = new DateRangeService()
    this.loggerService = loggerService

    // Domain Services
    this.dataPersistenceService = new DataPersistenceService(
      this.reportSaleRepository,
      this.reportReturnRepository,
      this.loggerService
    )
    
    this.syncCoordinator = new SyncCoordinator(
      this.datePeriodService,
      this.syncRegistryRepository,
      this.dataPersistenceService,
      this.loggerService
    )

    // Infrastructure Services
    this.orderSyncService = new OrderSyncService(
      this.apiClient,
      this.orderRepository
    )
    this.expenseSyncService = new ExpenseSyncService(
      this.apiClient,
      this.expenseRepository
    )
    this.reportSyncServiceV2 = new ReportSyncServiceV2(
      this.apiClient,
      this.dataAggregator,
      this.syncCoordinator,
      this.dataPersistenceService,
      this.syncRegistryRepository,
      this.loggerService
    )

    // Use Cases
    this.syncDataUseCase = new SyncDataUseCase(
      this.orderSyncService!,
      this.expenseSyncService!
    )
    this.calculatePnLUseCase = new CalculatePnLUseCase(
      this.reportSaleRepository,
      this.reportReturnRepository,
      this.orderRepository,
      this.expenseRepository
    )
    this.getWeeklyAnalyticsUseCase = new GetWeeklyAnalyticsUseCase(
      this.reportSaleRepository,
      this.reportReturnRepository
    )
  }

  /**
   * Переинициализирует контейнер с новым API ключом
   */
  reinitialize(apiKey?: string): void {
    const key = apiKey || localStorage.getItem('wb_api_key') || ''
    if (!key) {
      throw new Error('API ключ не найден. Укажите его в настройках.')
    }
    this.initialize(key)
  }

  getApiClient(): WBApiClient {
    if (!this.apiClient) {
      const apiKey = localStorage.getItem('wb_api_key') || ''
      this.apiClient = new WBApiClient({ 
        apiKey, 
        logger: this.getLoggerService() 
      })
    }
    return this.apiClient!
  }

  getOrderRepository(): OrderRepository {
    if (!this.orderRepository) this.orderRepository = new OrderRepository()
    return this.orderRepository
  }

  getReportSaleRepository(): ReportSaleRepository {
    if (!this.reportSaleRepository) this.reportSaleRepository = new ReportSaleRepository()
    return this.reportSaleRepository
  }

  getReportReturnRepository(): ReportReturnRepository {
    if (!this.reportReturnRepository) this.reportReturnRepository = new ReportReturnRepository()
    return this.reportReturnRepository
  }

  getSyncRegistryRepository(): SyncRegistryRepository {
    if (!this.syncRegistryRepository) this.syncRegistryRepository = new SyncRegistryRepository()
    return this.syncRegistryRepository
  }

  getExpenseRepository(): ExpenseRepository {
    if (!this.expenseRepository) this.expenseRepository = new ExpenseRepository()
    return this.expenseRepository
  }

  getStorageRepository(): StorageRepository {
    if (!this.storageRepository) this.storageRepository = new StorageRepository()
    return this.storageRepository
  }

  getAcceptanceRepository(): AcceptanceRepository {
    if (!this.acceptanceRepository) this.acceptanceRepository = new AcceptanceRepository()
    return this.acceptanceRepository
  }

  getProductRepository(): ProductRepository {
    if (!this.productRepository) this.productRepository = new ProductRepository()
    return this.productRepository
  }

  getDatePeriodService(): DatePeriodService {
    if (!this.datePeriodService) this.datePeriodService = new DatePeriodService()
    return this.datePeriodService
  }

  getDateRangeService(): DateRangeService {
    if (!this.dateRangeService) this.dateRangeService = new DateRangeService()
    return this.dateRangeService
  }

  getDataAggregator(): DataAggregator {
    if (!this.dataAggregator) this.dataAggregator = new DataAggregator()
    return this.dataAggregator
  }

  getDataPersistenceService(): DataPersistenceService {
    if (!this.dataPersistenceService) {
      this.dataPersistenceService = new DataPersistenceService(
        this.getReportSaleRepository(),
        this.getReportReturnRepository(),
        this.getLoggerService()
      )
    }
    return this.dataPersistenceService
  }

  getLoggerService(): LoggerService {
    if (!this.loggerService) this.loggerService = loggerService
    return this.loggerService
  }

  getSyncCoordinator(): SyncCoordinator {
    if (!this.syncCoordinator) {
      this.syncCoordinator = new SyncCoordinator(
        this.getDatePeriodService(),
        this.getSyncRegistryRepository(),
        this.getDataPersistenceService(),
        this.getLoggerService()
      )
    }
    return this.syncCoordinator
  }

  getOrderSyncService(): OrderSyncService {
    if (!this.orderSyncService) {
      this.orderSyncService = new OrderSyncService(
        this.getApiClient(),
        this.getOrderRepository()
      )
    }
    return this.orderSyncService
  }

  getExpenseSyncService(): ExpenseSyncService {
    if (!this.expenseSyncService) {
      this.expenseSyncService = new ExpenseSyncService(
        this.getApiClient(),
        this.getExpenseRepository()
      )
    }
    return this.expenseSyncService
  }

  getReportSyncServiceV2(): ReportSyncServiceV2 {
    if (!this.reportSyncServiceV2) {
      this.reportSyncServiceV2 = new ReportSyncServiceV2(
        this.getApiClient(),
        this.getDataAggregator(),
        this.getSyncCoordinator(),
        this.getDataPersistenceService(),
        this.getSyncRegistryRepository(),
        this.getLoggerService()
      )
    }
    return this.reportSyncServiceV2
  }

  getSummaryService(): SummaryService {
    if (!this.summaryService) {
      this.summaryService = new SummaryService(
        this.getReportSaleRepository(),
        this.getReportReturnRepository(),
        this.getSyncRegistryRepository(),
        this.getDatePeriodService()
      )
    }
    return this.summaryService
  }

  getProductService(): ProductService {
    if (!this.productService) {
      this.productService = new ProductService(
        this.getProductRepository(),
        this.getApiClient(),
        this.getLoggerService()
      )
    }
    return this.productService
  }

  getCategoryService(): CategoryService {
    if (!this.categoryService) {
      this.categoryService = new CategoryService(
        this.getReportSaleRepository(),
        this.getReportReturnRepository()
      )
    }
    return this.categoryService
  }

  getVendorCodeService(): VendorCodeService {
    if (!this.vendorCodeService) {
      this.vendorCodeService = new VendorCodeService(
        this.getReportSaleRepository(),
        this.getReportReturnRepository()
      )
    }
    return this.vendorCodeService
  }

  getSyncDataUseCase(): SyncDataUseCase {
    if (!this.syncDataUseCase) {
      this.syncDataUseCase = new SyncDataUseCase(
        this.getOrderSyncService(),
        this.getExpenseSyncService()
      )
    }
    return this.syncDataUseCase
  }

  getCalculatePnLUseCase(): CalculatePnLUseCase {
    if (!this.calculatePnLUseCase) {
      this.calculatePnLUseCase = new CalculatePnLUseCase(
        this.getReportSaleRepository(),
        this.getReportReturnRepository(),
        this.getOrderRepository(),
        this.getExpenseRepository()
      )
    }
    return this.calculatePnLUseCase
  }

  getGetWeeklyAnalyticsUseCase(): GetWeeklyAnalyticsUseCase {
    if (!this.getWeeklyAnalyticsUseCase) {
      this.getWeeklyAnalyticsUseCase = new GetWeeklyAnalyticsUseCase(
        this.getReportSaleRepository(),
        this.getReportReturnRepository()
      )
    }
    return this.getWeeklyAnalyticsUseCase
  }
}

export const container = DIContainer.getInstance()
