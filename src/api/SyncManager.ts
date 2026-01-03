import { WbApiClient } from './WbApiClient'
import { FinanceFetcher } from './fetchers/FinanceFetcher'
import { AdvFetcher } from './fetchers/AdvFetcher'
import { AcceptanceFetcher } from './fetchers/AcceptanceFetcher'
import { StorageFetcher } from './fetchers/StorageFetcher'
import { OrdersStatsFetcher } from './fetchers/OrdersStatsFetcher'
import { ContentFetcher } from './fetchers/ContentFetcher'
import { StocksFetcher } from './fetchers/StocksFetcher'

/**
 * Менеджер синхронизации данных
 * Управляет всеми fetcher-ами и координирует процесс загрузки
 */
export class SyncManager {
  private apiClient: WbApiClient
  public financeFetcher: FinanceFetcher
  public advFetcher: AdvFetcher
  public acceptanceFetcher: AcceptanceFetcher
  public storageFetcher: StorageFetcher
  public ordersStatsFetcher: OrdersStatsFetcher
  public contentFetcher: ContentFetcher
  public stocksFetcher: StocksFetcher

  constructor() {
    this.apiClient = new WbApiClient()
    this.financeFetcher = new FinanceFetcher(this.apiClient)
    this.advFetcher = new AdvFetcher(this.apiClient)
    this.acceptanceFetcher = new AcceptanceFetcher(this.apiClient)
    this.storageFetcher = new StorageFetcher(this.apiClient)
    this.ordersStatsFetcher = new OrdersStatsFetcher(this.apiClient)
    this.contentFetcher = new ContentFetcher(this.apiClient)
    this.stocksFetcher = new StocksFetcher(this.apiClient)
  }

  /**
   * Устанавливает API ключ для всех fetcher-ов
   */
  setApiKey(apiKey: string): void {
    this.apiClient.setApiKey(apiKey)
  }

  /**
   * Запускает полную синхронизацию всех данных (финансы + реклама + приемка + хранение + заказы + карточки + остатки)
   * Загрузка происходит параллельно для ускорения процесса
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @param period Период: 'daily' или 'weekly'
   * @returns Общее количество загруженных записей (финансы + реклама + приемка + хранение + заказы + карточки + остатки)
   */
  async startFullSync(
    dateFrom: string,
    dateTo: string,
    period: 'daily' | 'weekly' = 'weekly'
  ): Promise<number> {
    // Сбрасываем состояние всех fetcher-ов
    this.financeFetcher.reset()
    this.advFetcher.reset()
    this.acceptanceFetcher.reset()
    this.storageFetcher.reset()
    this.ordersStatsFetcher.reset()
    this.contentFetcher.reset()
    this.stocksFetcher.reset()

    // Запускаем параллельную загрузку всех данных
    // Карточки и остатки загружаются независимо от периода (без dateFrom/dateTo)
    const [financeCount, adsCount, acceptanceCount, storageCount, ordersCount, cardsCount, stocksCount] = await Promise.all([
      this.financeFetcher.fetchFullReport(dateFrom, dateTo, period),
      this.advFetcher.fetchAds(dateFrom, dateTo),
      this.acceptanceFetcher.fetchAcceptance(dateFrom, dateTo),
      this.storageFetcher.fetchStorage(dateFrom, dateTo),
      this.ordersStatsFetcher.fetchOrders(dateFrom, dateTo),
      this.contentFetcher.fetchCards(),
      this.stocksFetcher.fetchStocks(),
    ])

    return financeCount + adsCount + acceptanceCount + storageCount + ordersCount + cardsCount + stocksCount
  }

  /**
   * Получает fetcher для финансовых отчетов (для доступа к реактивным полям)
   */
  getFinanceFetcher(): FinanceFetcher {
    return this.financeFetcher
  }

  /**
   * Получает fetcher для рекламных расходов (для доступа к реактивным полям)
   */
  getAdvFetcher(): AdvFetcher {
    return this.advFetcher
  }

  /**
   * Получает fetcher для стоимости приемки (для доступа к реактивным полям)
   */
  getAcceptanceFetcher(): AcceptanceFetcher {
    return this.acceptanceFetcher
  }

  /**
   * Получает fetcher для стоимости хранения (для доступа к реактивным полям)
   */
  getStorageFetcher(): StorageFetcher {
    return this.storageFetcher
  }

  /**
   * Получает fetcher для статистики заказов (для доступа к реактивным полям)
   */
  getOrdersStatsFetcher(): OrdersStatsFetcher {
    return this.ordersStatsFetcher
  }

  /**
   * Получает fetcher для карточек товаров (для доступа к реактивным полям)
   */
  getContentFetcher(): ContentFetcher {
    return this.contentFetcher
  }

  /**
   * Получает fetcher для остатков на складах (для доступа к реактивным полям)
   */
  getStocksFetcher(): StocksFetcher {
    return this.stocksFetcher
  }

  /**
   * Проверяет, идет ли синхронизация
   */
  isSyncing(): boolean {
    return this.financeFetcher.isFetching.value || 
           this.advFetcher.isFetching.value || 
           this.acceptanceFetcher.isFetching.value ||
           this.storageFetcher.isFetching.value ||
           this.ordersStatsFetcher.isFetching.value ||
           this.contentFetcher.isFetching.value ||
           this.stocksFetcher.isFetching.value
  }
}

