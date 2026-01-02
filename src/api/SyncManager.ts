import { WbApiClient } from './WbApiClient'
import { FinanceFetcher } from './fetchers/FinanceFetcher'
import { AdvFetcher } from './fetchers/AdvFetcher'
import { AcceptanceFetcher } from './fetchers/AcceptanceFetcher'

/**
 * Менеджер синхронизации данных
 * Управляет всеми fetcher-ами и координирует процесс загрузки
 */
export class SyncManager {
  private apiClient: WbApiClient
  public financeFetcher: FinanceFetcher
  public advFetcher: AdvFetcher
  public acceptanceFetcher: AcceptanceFetcher

  constructor() {
    this.apiClient = new WbApiClient()
    this.financeFetcher = new FinanceFetcher(this.apiClient)
    this.advFetcher = new AdvFetcher(this.apiClient)
    this.acceptanceFetcher = new AcceptanceFetcher(this.apiClient)
  }

  /**
   * Устанавливает API ключ для всех fetcher-ов
   */
  setApiKey(apiKey: string): void {
    this.apiClient.setApiKey(apiKey)
  }

  /**
   * Запускает полную синхронизацию всех данных (финансы + реклама + приемка)
   * Загрузка происходит параллельно для ускорения процесса
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   * @param period Период: 'daily' или 'weekly'
   * @returns Общее количество загруженных записей (финансы + реклама + приемка)
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

    // Запускаем параллельную загрузку всех данных
    const [financeCount, adsCount, acceptanceCount] = await Promise.all([
      this.financeFetcher.fetchFullReport(dateFrom, dateTo, period),
      this.advFetcher.fetchAds(dateFrom, dateTo),
      this.acceptanceFetcher.fetchAcceptance(dateFrom, dateTo),
    ])

    return financeCount + adsCount + acceptanceCount
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
   * Проверяет, идет ли синхронизация
   */
  isSyncing(): boolean {
    return this.financeFetcher.isFetching.value || 
           this.advFetcher.isFetching.value || 
           this.acceptanceFetcher.isFetching.value
  }
}

