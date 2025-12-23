import axios, { type AxiosInstance } from 'axios'
import type { Order } from '@core/domain/entities/Order'
import type { Sale } from '@core/domain/entities/Sale'
import type { Expense } from '@core/domain/entities/Expense'
import type { Storage } from '@core/domain/entities/Storage'
import type { Acceptance } from '@core/domain/entities/Acceptance'
import { WbApiService } from './wbApiService'
import type { LoggerService } from '@application/services/LoggerService'

export interface WBApiConfig {
  apiKey: string
  baseURL?: string
  onRetry?: (retryCount: number) => void // Callback для обработки 429 ошибок
  logger: LoggerService
}

export class WBApiClient {
  private client: AxiosInstance
  private apiKey: string
  private logger: LoggerService
  private v5ApiService: WbApiService | null = null
  private onRetryCallback?: (retryCount: number) => void

  constructor(config: WBApiConfig) {
    this.apiKey = config.apiKey
    this.logger = config.logger
    this.onRetryCallback = config.onRetry
    
    // Определяем базовый URL: используем прокси, если указан в переменных окружения
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false' // По умолчанию используем прокси в dev
    const directUrl = 'https://statistics-api.wildberries.ru/api/v1/supplier'
    
    const baseURL = config.baseURL || (useProxy ? `${proxyUrl}/api/v1/supplier` : directUrl)
    const isProxy = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')
    
    // Если используется прокси, передаем ключ в заголовке X-WB-API-Key
    // Иначе используем стандартный Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = config.apiKey
    } else {
      headers['Authorization'] = config.apiKey
    }
    
    this.client = axios.create({
      baseURL,
      headers,
    })
  }

  async getOrders(dateFrom: string, dateTo?: string): Promise<Order[]> {
    const params: Record<string, string> = { dateFrom }
    if (dateTo) params.dateTo = dateTo

    const response = await this.client.get<Order[]>('/orders', { params })
    return response.data
  }

  async getSales(dateFrom: string, dateTo?: string): Promise<Sale[]> {
    const params: Record<string, string> = { dateFrom }
    if (dateTo) params.dateTo = dateTo

    const response = await this.client.get<Sale[]>('/sales', { params })
    return response.data
  }

  async getExpenses(dateFrom: string, dateTo?: string): Promise<Expense[]> {
    const params: Record<string, string> = { dateFrom }
    if (dateTo) params.dateTo = dateTo

    const response = await this.client.get<Expense[]>('/expenses', { params })
    return response.data
  }

  async getStorage(dateFrom?: string): Promise<Storage[]> {
    const params: Record<string, string> = {}
    if (dateFrom) params.dateFrom = dateFrom

    const response = await this.client.get<Storage[]>('/stocks', { params })
    return response.data
  }

  async getAcceptance(dateFrom: string, dateTo?: string): Promise<Acceptance[]> {
    const params: Record<string, string> = { dateFrom }
    if (dateTo) params.dateTo = dateTo

    const response = await this.client.get<Acceptance[]>('/incomes', { params })
    return response.data
  }

  /**
   * Получает детальный финансовый отчет за период
   * Использует WbApiService для обработки 429 ошибок с бесконечными повторами
   * @param dateFrom Начало периода (RFC3339)
   * @param dateTo Конец периода (RFC3339)
   * @param rrdId ID последней записи для пагинации (опционально)
   * @param period Периодичность отчета: 'weekly' (еженедельный) или 'daily' (ежедневный). По умолчанию 'weekly'
   * @returns Массив записей отчета
   */
  async getReportDetailByPeriod(
    dateFrom: string,
    dateTo: string,
    rrdId?: number,
    period: 'weekly' | 'daily' = 'weekly'
  ): Promise<any[]> {
    // Создаем сервис для v5 API при первом использовании
    if (!this.v5ApiService) {
      this.v5ApiService = new WbApiService(
        this.apiKey,
        'https://statistics-api.wildberries.ru/api/v5/supplier',
        this.logger
      )
    }

    const params: Record<string, string | number> = {
      dateFrom,
      dateTo,
      period,
    }
    if (rrdId !== undefined) {
      params.rrd_id = rrdId
    }

    // Используем requestWithRetry для автоматической обработки 429 ошибок
    return await this.v5ApiService.requestWithRetry<any[]>({
      url: '/reportDetailByPeriod',
      method: 'GET',
      params,
      onRetry: this.onRetryCallback,
    })
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    
    // Определяем, используется ли прокси
    const baseURL = this.client.defaults.baseURL || ''
    const isProxy = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')
    
    if (isProxy) {
      this.client.defaults.headers['X-WB-API-Key'] = apiKey
      delete this.client.defaults.headers['Authorization']
    } else {
      this.client.defaults.headers['Authorization'] = apiKey
      delete this.client.defaults.headers['X-WB-API-Key']
    }
    
    // Обновляем ключ в v5 сервисе, если он уже создан
    if (this.v5ApiService) {
      this.v5ApiService.setApiKey(apiKey)
    }
  }

  /**
   * Устанавливает callback для обработки 429 ошибок
   */
  setOnRetryCallback(callback: (retryCount: number) => void): void {
    this.onRetryCallback = callback
  }

  /**
   * Получает список карточек товаров с пагинацией
   * Использует POST запрос на /content/v2/get/cards/list
   * @param cursor Курсор для пагинации - может быть nmID (number) или объект cursor из предыдущего ответа
   * @returns Ответ API с массивом карточек и информацией о пагинации
   */
  async getProductCards(cursor?: number | { limit?: number; updatedAt?: string; nmID?: number }): Promise<{
    cards: any[]
    cursor: { limit?: number; updatedAt?: string; nmID?: number }
    total: number
  }> {
    // Создаем сервис для v2 API при первом использовании
    if (!this.v5ApiService) {
      // Для v2 API используем тот же подход с прокси
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
      const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
      const directUrl = 'https://content-api.wildberries.ru/content/v2'
      const v2BaseURL = useProxy ? `${proxyUrl}/content/v2` : directUrl
      
      this.v5ApiService = new WbApiService(
        this.apiKey,
        v2BaseURL,
        this.logger
      )
    }

    // Для getProductCards используем отдельный сервис с правильным baseURL
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    const directUrl = 'https://suppliers-api.wildberries.ru/content/v2'
    const v2BaseURL = useProxy ? `${proxyUrl}/content/v2` : directUrl
    
    const v2ApiService = new WbApiService(
      this.apiKey,
      v2BaseURL,
      this.logger
    )

    // Тело запроса для POST
    // Согласно документации WB API v2, структура запроса должна содержать settings объект
    const requestBody: any = {
      settings: {
        cursor: {
          limit: 100, // Максимальное количество записей за раз (максимум 100)
        },
        filter: {
          withPhoto: -1, // -1 = все карточки, независимо от наличия фото
        }
      }
    }

    // Если есть cursor (число или объект), используем его для пагинации
    if (cursor !== undefined) {
      if (typeof cursor === 'number') {
        // Если cursor - это nmID (число), используем его
        requestBody.settings.cursor.nmID = cursor
      } else if (typeof cursor === 'object' && cursor !== null) {
        // Если cursor - это объект, используем его полностью
        requestBody.settings.cursor = { 
          ...requestBody.settings.cursor, 
          ...(cursor as { limit?: number; updatedAt?: string; nmID?: number })
        }
      }
    }

    // Используем requestWithRetry для автоматической обработки 429 ошибок
    const response = await v2ApiService.requestWithRetry<{
      cards?: any[]
      data?: any[]
      cursor?: { limit?: number; updatedAt?: string; nmID?: number }
      total?: number
      error?: any
    }>({
      url: '/get/cards/list', // Попробуем стандартный путь
      method: 'POST',
      data: requestBody,
      onRetry: this.onRetryCallback,
    })

    // Обрабатываем ответ API
    const cards = response.cards || response.data || []
    const cursorObj = response.cursor || { limit: 100 }
    const total = response.total || 0

    return {
      cards,
      cursor: cursorObj as { limit?: number; updatedAt?: string; nmID?: number },
      total,
    }
  }
}
