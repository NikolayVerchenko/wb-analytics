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
  private _supplyOrders404Logged: boolean = false

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

  /**
   * Получает одну страницу детального отчета о реализации (v5)
   * Выполняет один GET запрос к /api/v5/supplier/reportDetailByPeriod
   * @param params Параметры запроса (dateFrom и dateTo в формате YYYY-MM-DD)
   * @returns Массив записей отчета или пустой массив при 204
   */
  async getSalesDetail(params: {
    dateFrom: string // YYYY-MM-DD
    dateTo: string // YYYY-MM-DD
    rrd_id?: number
    period?: 'weekly' | 'daily' // Периодичность отчета: weekly (по умолчанию) или daily
  }): Promise<any[]> {
    // Форматируем даты в RFC3339 с временем
    // По документации API: время передается в часовом поясе Москва (UTC+3)
    // dateFrom: YYYY-MM-DD -> YYYY-MM-DDTHH:mm:ss+03:00 (начало дня)
    // dateTo: YYYY-MM-DD -> YYYY-MM-DDTHH:mm:ss+03:00 (конец дня)
    const dateFromFormatted = `${params.dateFrom}T00:00:00+03:00`
    const dateToFormatted = `${params.dateTo}T23:59:59+03:00`

    const requestParams: Record<string, string | number> = {
      dateFrom: dateFromFormatted,
      dateTo: dateToFormatted,
      limit: 100000, // Максимальный лимит по документации (<= 100000)
      period: params.period || 'weekly', // По умолчанию weekly
    }

    // По документации API параметр должен быть rrdid, а не rrd_id
    if (params.rrd_id !== undefined && params.rrd_id > 0) {
      requestParams.rrdid = params.rrd_id
    }

    try {
      // Выполняем запрос напрямую через axios для обработки 204 статуса
      const baseURL = 'https://statistics-api.wildberries.ru/api/v5/supplier'
      const headers = await this.getHeaders() // Используем getHeaders() для получения Authorization

      const response = await axios.get(baseURL + '/reportDetailByPeriod', {
        params: requestParams,
        headers,
        validateStatus: (status) => status === 200 || status === 204, // Разрешаем 204
      })

      // Если получили 204, возвращаем пустой массив
      if (response.status === 204) {
        return []
      }

      return response.data || []
    } catch (error: any) {
      // Если получили 204 статус (No Content), возвращаем пустой массив
      if (error?.response?.status === 204) {
        return []
      }

      // Обработка ошибки 401 (Неверный API ключ)
      if (error?.response?.status === 401) {
        const authError = new Error('Неверный API-ключ. Проверьте настройки.')
        ;(authError as any).status = 401
        throw authError
      }

      // Обработка ошибки 429 (Too Many Requests)
      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повтор через 61 секунду.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      // Для других ошибок выбрасываем исключение
      this.logger.add('error', `[WBApiClient] Ошибка при запросе getSalesDetail: ${error.message}`)
      throw error
    }
  }

  /**
   * Получает детальный отчет о реализации (v5) с рекурсивной пагинацией
   * Запрашивает данные через rrdid до получения 204 статуса
   * @param dateFrom Начало периода (RFC3339 или YYYY-MM-DD)
   * @param dateTo Конец периода (RFC3339 или YYYY-MM-DD)
   * @param rrdid ID последней записи для пагинации (по умолчанию 0)
   * @returns Массив всех записей отчета
   */
  async fetchReportDetail(
    dateFrom: string,
    dateTo: string,
    rrdid: number = 0
  ): Promise<any[]> {
    // Создаем сервис для v5 API при первом использовании
    if (!this.v5ApiService) {
      this.v5ApiService = new WbApiService(
        this.apiKey,
        'https://statistics-api.wildberries.ru/api/v5/supplier',
        this.logger
      )
    }

    const allResults: any[] = []
    let currentRrdid = rrdid
    let hasMore = true
    const rateLimitDelay = 60000 // 1 минута между запросами (лимит API)

    this.logger.add('info', `[WBApiClient] Начало загрузки отчета: ${dateFrom} - ${dateTo}, начальный rrdid: ${currentRrdid}`)

    while (hasMore) {
      try {
        const params: Record<string, string | number> = {
          dateFrom,
          dateTo,
        }
        
        if (currentRrdid > 0) {
          params.rrd_id = currentRrdid
        }

        // Выполняем запрос напрямую через axios для обработки 204 статуса
        // requestWithRetry не обрабатывает 204 корректно
        const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
        const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
        const baseURL = useProxy 
          ? `${proxyUrl}/api/v5/supplier`
          : 'https://statistics-api.wildberries.ru/api/v5/supplier'
        const isProxy = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        
        if (isProxy) {
          headers['X-WB-API-Key'] = this.apiKey
        } else {
          headers['Authorization'] = this.apiKey
        }

        const response = await axios.get(baseURL + '/reportDetailByPeriod', {
          params,
          headers,
          validateStatus: (status) => status === 200 || status === 204, // Разрешаем 204
        })

        // Если получили 204, прекращаем пагинацию
        if (response.status === 204) {
          hasMore = false
          this.logger.add('info', `[WBApiClient] Получен статус 204, пагинация завершена`)
          break
        }

        const data = response.data || []

        // Если получили пустой массив, прекращаем пагинацию
        if (!data || data.length === 0) {
          hasMore = false
          this.logger.add('info', `[WBApiClient] Получен пустой ответ, пагинация завершена`)
          break
        }

        // Добавляем результаты
        allResults.push(...data)
        this.logger.add('info', `[WBApiClient] Загружено ${data.length} записей, всего: ${allResults.length}`)

        // Определяем следующий rrdid из последней записи
        const lastRecord = data[data.length - 1]
        if (lastRecord?.rrd_id !== undefined && lastRecord.rrd_id !== null) {
          const nextRrdid = lastRecord.rrd_id
          
          // Если следующий rrdid равен текущему или меньше, прекращаем
          if (nextRrdid <= currentRrdid) {
            hasMore = false
            this.logger.add('info', `[WBApiClient] Следующий rrdid (${nextRrdid}) <= текущего (${currentRrdid}), пагинация завершена`)
            break
          }
          
          currentRrdid = nextRrdid
        } else {
          // Если rrd_id отсутствует, прекращаем пагинацию
          hasMore = false
          this.logger.add('info', `[WBApiClient] rrd_id отсутствует в последней записи, пагинация завершена`)
          break
        }

        // Задержка между запросами (1 минута для соблюдения лимита API)
        if (hasMore) {
          this.logger.add('info', `[WBApiClient] Ожидание ${rateLimitDelay / 1000} сек перед следующим запросом...`)
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay))
        }

      } catch (error: any) {
        // Если получили 204 статус (No Content), прекращаем пагинацию
        if (error?.response?.status === 204) {
          hasMore = false
          this.logger.add('info', `[WBApiClient] Получен статус 204, пагинация завершена`)
          break
        }
        
        // Для других ошибок выбрасываем исключение
        this.logger.add('error', `[WBApiClient] Ошибка при загрузке отчета: ${error.message}`)
        throw error
      }
    }

    this.logger.add('info', `[WBApiClient] Загрузка отчета завершена, всего записей: ${allResults.length}`)
    return allResults
  }

  /**
   * Получает заголовки авторизации для запросов к statistics-api
   * Извлекает API-ключ из SettingsRepository
   * @returns Заголовки с Authorization
   */
  async getHeaders(): Promise<Record<string, string>> {
    // Получаем API ключ из базы данных
    let apiKey = this.apiKey
    try {
      // Динамический импорт для избежания циклических зависимостей
      const { SettingsRepository } = await import('@infrastructure/repositories/SettingsRepository')
      const settingsRepository = new SettingsRepository()
      const storedKey = await settingsRepository.getApiKey()
      if (storedKey) {
        apiKey = storedKey
      }
    } catch (error) {
      // Если не удалось получить из БД, используем текущий ключ
      this.logger.add('warn', '[WBApiClient] Не удалось получить API ключ из SettingsRepository')
    }

    // Очищаем ключ от пробелов и невидимых символов для предотвращения ошибок кодировки
    // HTTP заголовки должны содержать только ISO-8859-1 символы
    const cleanedKey = apiKey.trim().replace(/[\r\n\t]/g, '')

    return {
      'Authorization': cleanedKey,
      'Content-Type': 'application/json',
    }
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

  /**
   * Получает поставки из WB API
   * @param dateFrom Начальная дата (ISO string)
   * @param dateTo Конечная дата (ISO string)
   * @param limit Лимит записей (по умолчанию 1000)
   * @param offset Смещение для пагинации (по умолчанию 0)
   */
  async getWBSupplies(
    dateFrom: string,
    dateTo: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<{
    supplies: Array<{
      supplyID: string
      preorderID?: string
      createDate: string
      statusID: number
      factDate?: string
      quantity?: number
    }>
    total: number
  }> {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    
    // Используем прокси для запроса к API поставок
    // Прокси настроен на /supplies-api/*, поэтому путь должен быть /supplies-api/api/v1/supplies
    // Без прокси: endpoint должен быть /api/v1/supplies (без /supplier)
    const baseURL = useProxy ? proxyUrl : 'https://supplies-api.wildberries.ru'
    
    // Формируем query параметры для limit и offset
    // Убеждаемся, что они передаются как числа
    const params = new URLSearchParams()
    if (limit !== undefined && limit !== null) {
      params.append('limit', limit.toString())
    }
    if (offset !== undefined && offset !== null) {
      params.append('offset', offset.toString())
    }
    
    // Формируем URL с query параметрами
    const basePath = useProxy ? '/supplies-api/api/v1/supplies' : '/api/v1/supplies'
    const url = params.toString() ? `${basePath}?${params.toString()}` : basePath
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (useProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Согласно примеру запроса, структура должна быть:
    // - dates[].from - начальная дата
    // - dates[].till - конечная дата (не "to"!)
    // - dates[].type - тип даты ("factDate" для фактической даты)
    // - statusIDs - массив статусов
    const requestBody: any = {
      dates: [
        {
          from: dateFrom, // Уже в формате YYYY-MM-DD из SupplyService
          till: dateTo,   // Используем "till" вместо "to"
          type: "factDate", // Тип даты: "factDate" для фактической даты поставки
        },
      ],
      statusIDs: [1, 2, 3, 4, 5, 6],
    }

    try {
      // Используем axios напрямую для запроса к API поставок
      // API возвращает массив объектов напрямую или объект с полем data
      const response = await axios.post<Array<{
        supplyID: string | null
        preorderID?: number | string
        createDate: string
        statusID: number
        factDate?: string | null
        quantity?: number
        phone?: string
        supplyDate?: string | null
        updatedDate?: string | null
      }> | {
        data?: Array<{
          supplyID: string | null
          preorderID?: number | string
          createDate: string
          statusID: number
          factDate?: string | null
          quantity?: number
        }>
        total?: number
        error?: boolean
        errorText?: string
      }>(
        url,
        requestBody,
        {
          baseURL,
          headers,
        }
      )

      // API возвращает массив поставок напрямую, а не объект с полем data
      // Проверяем, является ли ответ массивом
      if (Array.isArray(response.data)) {
        return {
          supplies: response.data,
          total: response.data.length,
        }
      }
      
      // Если ответ - объект с полем error
      if (response.data.error) {
        throw new Error(response.data.errorText || 'Ошибка при получении поставок')
      }
      
      // Если ответ - объект с полем data
      const supplies = response.data.data || []
      const total = response.data.total || supplies.length

      return {
        supplies,
        total,
      }
    } catch (error: any) {
      this.logger.add('error', `Ошибка при получении поставок: ${error.message}`)
      throw error
    }
  }

  /**
   * Получает товары в поставке (правильный эндпоинт)
   * @param supplyId ID поставки или заказа
   * @param isPreorderID true, если supplyId является preorderID, false если supplyID
   * @param limit Количество записей в ответе (1-1000, по умолчанию 100)
   * @param offset После какого элемента выдавать данные (по умолчанию 0)
   */
  async getSupplyGoods(
    supplyId: number | string,
    isPreorderID: boolean = false,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{
    barcode?: string
    vendorCode?: string
    nmID: number
    needKiz?: boolean
    tnved?: string | null
    techSize?: string
    color?: string | null
    supplierBoxAmount?: number | null
    quantity: number
    readyForSaleQuantity?: number | null
    acceptedQuantity?: number | null
    unloadingQuantity?: number | null
  }>> {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    
    // Формируем URL для получения товаров поставки
    const baseURL = useProxy ? proxyUrl : 'https://supplies-api.wildberries.ru'
    const url = useProxy 
      ? `/supplies-api/api/v1/supplies/${supplyId}/goods` 
      : `/api/v1/supplies/${supplyId}/goods`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (useProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Формируем query параметры
    const params: Record<string, string | number | boolean> = {
      limit: Math.min(Math.max(1, limit), 1000), // Ограничиваем 1-1000
      offset: Math.max(0, offset),
      isPreorderID: isPreorderID,
    }

    try {
      const response = await axios.get<
        Array<{
          barcode?: string
          vendorCode?: string
          nmID: number
          needKiz?: boolean
          tnved?: string | null
          techSize?: string
          color?: string | null
          supplierBoxAmount?: number | null
          quantity: number
          readyForSaleQuantity?: number | null
          acceptedQuantity?: number | null
          unloadingQuantity?: number | null
        }>
      >(
        url,
        {
          baseURL,
          headers,
          params,
        }
      )

      return response.data || []
    } catch (error: any) {
      // Если 404, возможно поставка не имеет товаров или не существует
      if (error.response?.status === 404) {
        if (!this._supplyOrders404Logged) {
          this.logger.add('warn', `Товары поставки ${supplyId} не найдены (404). Возможно, поставка не имеет товаров или не существует.`)
          this._supplyOrders404Logged = true
        }
        return []
      }
      
      // Для других ошибок логируем детально
      if (error.response) {
        this.logger.add('error', `Ошибка при получении товаров поставки ${supplyId}: ${error.response.status} ${error.response.statusText}. URL: ${baseURL}${url}`)
      } else {
        this.logger.add('error', `Ошибка при получении товаров поставки ${supplyId}: ${error.message}`)
      }
      
      // Не пробрасываем ошибку дальше, чтобы не блокировать синхронизацию других поставок
      return []
    }
  }

  /**
   * Получает детали рекламных кампаний
   * @param ids Массив ID рекламных кампаний (максимум 50 в одном запросе)
   * @returns Массив деталей рекламных кампаний
   */
  async getAdvertsDetails(ids: number[]): Promise<Array<{
    advertId: number
    name?: string
    type?: number
    status?: number
    dailyBudget?: number
    createTime?: number
    changeTime?: number
    startTime?: number
    endTime?: number
    keywords?: Array<{
      keyword: string
      active?: number
    }>
    nms?: number[] // Массив артикулов (nm_id) в кампании
    [key: string]: any
  }>> {
    if (ids.length === 0) {
      return []
    }

    // Ограничение API: максимум 50 ID в одном запросе
    const MAX_IDS_PER_REQUEST = 50
    const results: Array<{
      advertId: number
      name?: string
      type?: number
      status?: number
      dailyBudget?: number
      createTime?: number
      changeTime?: number
      startTime?: number
      endTime?: number
      keywords?: Array<{ keyword: string; active?: number }>
      nms?: number[]
      [key: string]: any
    }> = []

    // Разбиваем на батчи по 50 ID
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      const batch = ids.slice(i, i + MAX_IDS_PER_REQUEST)
      
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
      const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
      const directUrl = 'https://advert-api.wildberries.ru'
      const baseURL = useProxy ? proxyUrl : directUrl
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (useProxy) {
        headers['X-WB-API-Key'] = this.apiKey
      } else {
        headers['Authorization'] = this.apiKey
      }

      try {
        // Эндпоинт: GET /api/advert/v2/adverts
        // Параметры: ids - массив ID кампаний
        const url = useProxy ? '/advert-api/api/advert/v2/adverts' : '/api/advert/v2/adverts'
        const params = new URLSearchParams()
        batch.forEach(id => params.append('ids', id.toString()))
        
        const response = await axios.get<Array<{
          advertId: number
          name?: string
          type?: number
          status?: number
          dailyBudget?: number
          createTime?: number
          changeTime?: number
          startTime?: number
          endTime?: number
          keywords?: Array<{ keyword: string; active?: number }>
          nms?: number[]
          [key: string]: any
        }>>(
          `${url}?${params.toString()}`,
          {
            baseURL,
            headers,
          }
        )

        if (Array.isArray(response.data)) {
          results.push(...response.data)
        }
      } catch (error: any) {
        this.logger.add('error', `Ошибка при получении деталей рекламных кампаний: ${error.message}`)
        // Продолжаем обработку других батчей даже при ошибке
        console.error('Ошибка при получении деталей рекламных кампаний:', error)
      }
    }

    return results
  }

  /**
   * Получает историю затрат на рекламу
   * @param dateFrom Начальная дата (формат YYYY-MM-DD)
   * @param dateTo Конечная дата (формат YYYY-MM-DD)
   * @returns Массив записей о затратах с суммами и ID кампаний
   */
  async getAdvertsHistory(dateFrom: string, dateTo: string): Promise<Array<{
    date: string // Дата затрат (формат YYYY-MM-DD)
    advertId: number // ID рекламной кампании
    sum: number // Сумма затрат за день (updSum)
    updTime?: number // Время обновления от WB (timestamp)
    [key: string]: any
  }>> {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    const directUrl = 'https://advert-api.wildberries.ru'
    const baseURL = useProxy ? proxyUrl : directUrl
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (useProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    try {
      // Эндпоинт: GET /adv/v1/upd
      // Параметры: dateFrom, dateTo
      const url = useProxy ? '/advert-api/adv/v1/upd' : '/adv/v1/upd'
      const params = new URLSearchParams()
      params.append('dateFrom', dateFrom)
      params.append('dateTo', dateTo)
      
      const response = await axios.get<Array<{
        date: string
        advertId: number
        sum: number
        updTime?: number
        [key: string]: any
      }>>(
        `${url}?${params.toString()}`,
        {
          baseURL,
          headers,
        }
      )

      return response.data || []
    } catch (error: any) {
      this.logger.add('error', `Ошибка при получении истории рекламных затрат: ${error.message}`)
      console.error('Ошибка при получении истории рекламных затрат:', error)
      return []
    }
  }
}
