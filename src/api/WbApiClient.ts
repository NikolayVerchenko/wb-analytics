import axios from 'axios'

/**
 * Базовый API клиент для одиночных запросов к Wildberries API
 * Не содержит логику пагинации и циклов
 */
export class WbApiClient {
  private apiKey: string = ''
  private readonly baseURL: string

  constructor() {
    // Определяем базовый URL: используем прокси, если указан в переменных окружения
    // По умолчанию прокси ВКЛЮЧЕН (установите VITE_USE_PROXY=false для отключения)
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false' // По умолчанию включен
    const directUrl = 'https://statistics-api.wildberries.ru/api/v5/supplier'
    
    this.baseURL = useProxy ? `${proxyUrl}/api/v5/supplier` : directUrl
  }

  /**
   * Устанавливает API ключ
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim()
  }

  /**
   * Определяет, используется ли прокси
   */
  private isProxy(): boolean {
    return this.baseURL.includes('localhost') || this.baseURL.includes('127.0.0.1')
  }

  /**
   * Получает базовый URL для API рекламы
   */
  private getAdvertApiBaseUrl(): string {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    const directUrl = 'https://advert-api.wildberries.ru'
    
    return useProxy ? proxyUrl : directUrl
  }

  /**
   * Получает базовый URL для Seller Analytics API (приемка)
   */
  private getSellerAnalyticsApiBaseUrl(): string {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    const directUrl = 'https://seller-analytics-api.wildberries.ru'
    
    return useProxy ? proxyUrl : directUrl
  }

  /**
   * Создает задачу на генерацию отчета о платном хранении
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param dateFrom Начальная дата в формате YYYY-MM-DD или RFC3339
   * @param dateTo Конечная дата в формате YYYY-MM-DD или RFC3339
   * @returns ID задачи (taskId)
   */
  async createStorageTask(dateFrom: string, dateTo: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/paid_storage`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          params: {
            dateFrom,
            dateTo,
          },
          headers,
        })

        // Ответ: { data: { taskId: "..." } }
        const taskId = response.data?.data?.taskId
        if (!taskId) {
          console.error(`[WbApiClient] Не удалось извлечь taskId из ответа. Структура:`, response.data)
          throw new Error('Не удалось получить ID задачи из ответа API')
        }

        console.log(`[WbApiClient] Задача создания отчета о хранении создана успешно, taskId: ${taskId}`)
        return taskId
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для createStorageTask. Повтор через 10 секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Проверяет статус задачи на генерацию отчета о платном хранении
   * @param taskId ID задачи
   * @returns Статус задачи (new, processing, done, purged, canceled)
   */
  async getStorageStatus(taskId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/paid_storage/tasks/${taskId}/status`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    try {
      const response = await axios.get(url, {
        headers,
      })

      // Ответ: { data: { id: "...", status: "..." } }
      const status = response.data?.data?.status
      if (!status) {
        throw new Error('Не удалось получить статус задачи')
      }

      return status
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
        if (isProxy) {
          throw new Error(
            'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
            'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
          )
        } else {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
      }

      if (error?.response?.status === 401) {
        throw new Error('Неверный API-ключ. Проверьте настройки.')
      }

      if (error?.response?.status === 404) {
        throw new Error('Задача не найдена')
      }

      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повторите через 5 секунд.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      throw error
    }
  }

  /**
   * Скачивает отчет о платном хранении по ID задачи
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param taskId ID задачи
   * @returns Массив записей о хранении
   */
  async downloadStorageReport(taskId: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/paid_storage/tasks/${taskId}/download`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          headers,
        })

        // Логируем структуру ответа для отладки (только первые несколько записей, чтобы не засорять консоль)
        const data = response.data || []
        if (data.length > 0) {
          console.log(`[WbApiClient] Ответ downloadStorageReport: получено ${data.length} записей`)
          if (data.length <= 10) {
            console.log(`[WbApiClient] Данные:`, JSON.stringify(data, null, 2))
          } else {
            console.log(`[WbApiClient] Первые 3 записи:`, JSON.stringify(data.slice(0, 3), null, 2))
          }
        }

        // Ответ: массив объектов
        return data
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 404) {
          throw new Error('Отчет не найден')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для downloadStorageReport. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Получает одну страницу отчета о реализации
   * @param dateFrom Начальная дата в формате RFC3339
   * @param dateTo Конечная дата в формате RFC3339
   * @param period Период: 'daily' или 'weekly'
   * @param rrdid ID последней записи для пагинации (опционально)
   * @returns Массив записей отчета или пустой массив при 204
   */
  async fetchReportPage(
    dateFrom: string,
    dateTo: string,
    period: 'daily' | 'weekly' = 'weekly',
    rrdid?: number
  ): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const params: Record<string, string | number> = {
      dateFrom,
      dateTo,
      limit: 100000,
      period,
    }

    if (rrdid !== undefined && rrdid > 0) {
      params.rrdid = rrdid
    }

    try {
      // Если используется прокси, передаем ключ в заголовке X-WB-API-Key
      // Иначе используем стандартный Authorization
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (this.isProxy()) {
        headers['X-WB-API-Key'] = this.apiKey
      } else {
        headers['Authorization'] = this.apiKey
      }

      const response = await axios.get(this.baseURL + '/reportDetailByPeriod', {
        params,
        headers,
        validateStatus: (status) => status === 200 || status === 204,
      })

      // 204 означает конец данных
      if (response.status === 204) {
        return []
      }

      return response.data || []
    } catch (error: any) {
      if (error?.response?.status === 204) {
        return []
      }

      // Обработка ошибок подключения к прокси
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
        if (this.isProxy()) {
          throw new Error(
            'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
            'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
          )
        } else {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
      }

      if (error?.response?.status === 401) {
        throw new Error('Неверный API-ключ. Проверьте настройки.')
      }

      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повторите через 61 секунду.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      throw error
    }
  }

  /**
   * Получает историю затрат на рекламу
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param from Начальная дата в формате YYYY-MM-DD
   * @param to Конечная дата в формате YYYY-MM-DD
   * @returns Массив записей о затратах
   */
  async getAdvHistory(from: string, to: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getAdvertApiBaseUrl()
    const url = `${baseUrl}/adv/v1/upd`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          params: {
            from,
            to,
          },
          headers,
        })

        return response.data || []
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для getAdvHistory. Повтор через 10 секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Получает информацию о рекламных кампаниях
   * @param ids Массив ID кампаний (advertId), максимум 50 за раз
   * @returns Массив информации о кампаниях из поля adverts
   */
  async getAdvInfo(ids: number[]): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    if (!ids || ids.length === 0) {
      return []
    }

    // API ограничивает до 50 ID за запрос
    if (ids.length > 50) {
      throw new Error('Максимум 50 ID кампаний за один запрос')
    }

    const baseUrl = this.getAdvertApiBaseUrl()
    const url = `${baseUrl}/api/advert/v2/adverts`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    try {
      // API принимает ID как строку через запятую
      const response = await axios.get(url, {
        params: {
          ids: ids.join(','),
        },
        headers,
      })

      // Ответ имеет структуру { adverts: [...] }
      return response.data?.adverts || []
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
        if (isProxy) {
          throw new Error(
            'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
            'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
          )
        } else {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
      }

      if (error?.response?.status === 401) {
        throw new Error('Неверный API-ключ. Проверьте настройки.')
      }

      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повторите через некоторое время.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      throw error
    }
  }

  /**
   * Создает задачу на генерацию отчета о приемке товаров
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param dateFrom Начальная дата в формате YYYY-MM-DD
   * @param dateTo Конечная дата в формате YYYY-MM-DD
   * @returns ID задачи (taskId)
   */
  async createAcceptanceTask(dateFrom: string, dateTo: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/acceptance_report`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          params: {
            dateFrom,
            dateTo,
          },
          headers,
        })

        // Ответ: { data: { taskId: "..." } }
        const taskId = response.data?.data?.taskId
        if (!taskId) {
          console.error(`[WbApiClient] Не удалось извлечь taskId из ответа. Структура:`, response.data)
          throw new Error('Не удалось получить ID задачи из ответа API')
        }

        console.log(`[WbApiClient] Задача создана успешно, taskId: ${taskId}`)
        return taskId
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429). Повтор через 10 секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Проверяет статус задачи на генерацию отчета о приемке
   * @param taskId ID задачи
   * @returns Статус задачи ('done', 'processing', и т.д.)
   */
  async getAcceptanceStatus(taskId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/acceptance_report/tasks/${taskId}/status`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    try {
      const response = await axios.get(url, {
        headers,
      })

      // Ответ: { data: { id: "...", status: "..." } }
      const status = response.data?.data?.status
      if (!status) {
        throw new Error('Не удалось получить статус задачи')
      }

      return status
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
        if (isProxy) {
          throw new Error(
            'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
            'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
          )
        } else {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
      }

      if (error?.response?.status === 401) {
        throw new Error('Неверный API-ключ. Проверьте настройки.')
      }

      if (error?.response?.status === 404) {
        throw new Error('Задача не найдена')
      }

      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повторите через 5 секунд.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      throw error
    }
  }

  /**
   * Скачивает отчет о приемке товаров по ID задачи
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param taskId ID задачи
   * @returns Массив записей о приемке
   */
  async downloadAcceptanceReport(taskId: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/acceptance_report/tasks/${taskId}/download`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          headers,
        })

        // Логируем структуру ответа для отладки (оптимизированное логирование)
        const data = response.data || []
        if (data.length > 0) {
          console.log(`[WbApiClient] Ответ downloadAcceptanceReport: получено ${data.length} записей`)
          if (data.length <= 10) {
            console.log(`[WbApiClient] Данные:`, JSON.stringify(data, null, 2))
          } else {
            console.log(`[WbApiClient] Первые 3 записи:`, JSON.stringify(data.slice(0, 3), null, 2))
          }
        }

        // Ответ: массив объектов
        return data
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 404) {
          throw new Error('Отчет не найден')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для downloadAcceptanceReport. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Получает статистику заказов (Воронка продаж v3)
   * @param dateFrom Начальная дата периода (YYYY-MM-DD)
   * @param dateTo Конечная дата периода (YYYY-MM-DD)
   * @param offset Смещение для пагинации (по умолчанию 0)
   * @param limit Количество записей в ответе (максимум 1000, по умолчанию 50)
   * @returns Объект с данными: { products: Array, hasMore: boolean }
   */
  async fetchOrdersStats(
    dateFrom: string,
    dateTo: string,
    offset: number = 0,
    limit: number = 50
  ): Promise<{ products: any[]; hasMore: boolean }> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/analytics/v3/sales-funnel/products`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    const requestBody = {
      selectedPeriod: {
        start: dateFrom,
        end: dateTo,
      },
      nmIds: [],
      brandNames: [],
      subjectIds: [],
      tagIds: [],
      skipDeletedNm: false,
      limit: Math.min(limit, 1000), // API ограничивает до 1000
      offset: offset,
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.post(url, requestBody, {
          headers,
        })

        const data = response.data?.data || {}
        const products = data.products || []
        // Если количество продуктов меньше лимита, значит больше данных нет
        const hasMore = products.length >= limit

        return {
          products,
          hasMore,
        }
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для fetchOrdersStats. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        if (error?.response?.status === 400) {
          throw new Error(`Ошибка запроса (400): ${error.response.data?.message || 'Неверные параметры запроса'}`)
        }

        throw error
      }
    }
  }

  /**
   * Получает базовый URL для Content API
   */
  private getContentApiBaseUrl(): string {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3000'
    const useProxy = import.meta.env.VITE_USE_PROXY !== 'false'
    const directUrl = 'https://content-api.wildberries.ru'
    
    return useProxy ? proxyUrl : directUrl
  }

  /**
   * Получает список карточек товаров с пагинацией
   * @param cursor Объект курсора для пагинации { updatedAt?: string, nmID?: number }
   * @returns Объект с данными: { cards: Array, cursor: { updatedAt, nmID, total, limit } }
   */
  async fetchCardsList(cursor?: { updatedAt?: string; nmID?: number }): Promise<{
    cards: any[]
    cursor: { updatedAt: string; nmID: number; total: number; limit: number }
  }> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getContentApiBaseUrl()
    const url = `${baseUrl}/content/v2/get/cards/list`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками
    const limit = 100

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    const requestBody: any = {
      settings: {
        cursor: {
          limit: limit,
        },
        filter: {
          withPhoto: -1, // -1 = все карточки (с фото и без)
        },
      },
    }

    // Если передан cursor, добавляем его в запрос
    if (cursor) {
      requestBody.settings.cursor = {
        ...requestBody.settings.cursor,
        ...(cursor.updatedAt && { updatedAt: cursor.updatedAt }),
        ...(cursor.nmID && { nmID: cursor.nmID }),
      }
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        console.log(`[WbApiClient] fetchCardsList: запрос к ${url}`)
        console.log(`[WbApiClient] fetchCardsList: тело запроса:`, JSON.stringify(requestBody, null, 2))
        
        const response = await axios.post(url, requestBody, {
          headers,
        })

        console.log(`[WbApiClient] fetchCardsList: статус ответа: ${response.status}`)
        console.log(`[WbApiClient] fetchCardsList: структура ответа:`, JSON.stringify({
          hasData: !!response.data,
          hasCards: !!(response.data?.cards),
          cardsLength: response.data?.cards?.length || 0,
          hasCursor: !!(response.data?.cursor),
          cursorTotal: response.data?.cursor?.total,
        }, null, 2))

        const data = response.data || {}
        const cards = data.cards || []
        const cursorData = data.cursor || {}

        if (cards.length === 0 && cursorData.total === undefined) {
          console.warn(`[WbApiClient] fetchCardsList: получен пустой ответ, структура данных:`, JSON.stringify(data, null, 2))
        }

        return {
          cards,
          cursor: {
            updatedAt: cursorData.updatedAt || '',
            nmID: cursorData.nmID || 0,
            total: cursorData.total || 0,
            limit: limit,
          },
        }
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для fetchCardsList. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        if (error?.response?.status === 400) {
          throw new Error(`Ошибка запроса (400): ${error.response.data?.message || 'Неверные параметры запроса'}`)
        }

        throw error
      }
    }
  }

  /**
   * Создает задачу на генерацию отчета об остатках на складах
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @returns ID задачи (taskId)
   */
  async createStocksTask(): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/warehouse_remains`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // Повторяем запрос при ошибке 429
    while (true) {
      try {
        const response = await axios.get(url, {
          params: {
            groupByBrand: true,
            groupBySubject: true,
            groupBySa: true,
            groupByNm: true,
            groupBySize: true,
          },
          headers,
        })

        // Ответ: { data: { taskId: "..." } }
        const taskId = response.data?.data?.taskId
        if (!taskId) {
          console.error(`[WbApiClient] Не удалось извлечь taskId из ответа. Структура:`, response.data)
          throw new Error('Не удалось получить ID задачи из ответа API')
        }

        console.log(`[WbApiClient] Задача создания отчета об остатках создана успешно, taskId: ${taskId}`)
        return taskId
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 429) {
          // При ошибке 429 ждем 10 секунд и повторяем запрос
          console.log(`[WbApiClient] Лимит запросов (429) для createStocksTask. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }

  /**
   * Проверяет статус задачи на генерацию отчета об остатках на складах
   * @param taskId ID задачи
   * @returns Статус задачи (new, processing, done, purged, canceled)
   */
  async getStocksStatus(taskId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/warehouse_remains/tasks/${taskId}/status`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    try {
      const response = await axios.get(url, {
        headers,
      })

      // Ответ: { data: { id: "...", status: "..." } }
      const status = response.data?.data?.status
      if (!status) {
        throw new Error('Не удалось получить статус задачи')
      }

      return status
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
        if (isProxy) {
          throw new Error(
            'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
            'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
          )
        } else {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
      }

      if (error?.response?.status === 401) {
        throw new Error('Неверный API-ключ. Проверьте настройки.')
      }

      if (error?.response?.status === 404) {
        throw new Error('Задача не найдена')
      }

      if (error?.response?.status === 429) {
        const rateLimitError = new Error('Превышен лимит запросов. Повторите через 5 секунд.')
        ;(rateLimitError as any).status = 429
        throw rateLimitError
      }

      throw error
    }
  }

  /**
   * Скачивает отчет об остатках на складах по ID задачи
   * При ошибке 429 (лимит запросов) повторяет запрос каждые 10 секунд до успеха
   * @param taskId ID задачи
   * @returns Массив записей об остатках
   */
  async downloadStocksReport(taskId: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен')
    }

    const baseUrl = this.getSellerAnalyticsApiBaseUrl()
    const url = `${baseUrl}/api/v1/warehouse_remains/tasks/${taskId}/download`
    const isProxy = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    const retryInterval = 10000 // 10 секунд между повторными попытками

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    while (true) {
      try {
        const response = await axios.get(url, {
          headers,
        })

        // Логируем структуру ответа для отладки (оптимизированное логирование)
        if (response.data && Array.isArray(response.data) && response.data.length > 10) {
          console.log(`[WbApiClient] Ответ downloadStocksReport: получено ${response.data.length} записей. Первые 3:`, JSON.stringify(response.data.slice(0, 3), null, 2))
        } else {
          console.log(`[WbApiClient] Ответ downloadStocksReport:`, JSON.stringify(response.data, null, 2))
        }

        // Ответ: массив объектов
        return response.data || []
      } catch (error: any) {
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ERR_CONNECTION_REFUSED') {
          if (isProxy) {
            throw new Error(
              'Прокси-сервер недоступен. Запустите прокси-сервер командой "npm run server" ' +
              'или отключите прокси, установив VITE_USE_PROXY=false в .env файле.'
            )
          } else {
            throw new Error('Ошибка сети. Проверьте подключение к интернету.')
          }
        }

        if (error?.response?.status === 401) {
          throw new Error('Неверный API-ключ. Проверьте настройки.')
        }

        if (error?.response?.status === 404) {
          throw new Error('Отчет не найден')
        }

        if (error?.response?.status === 429) {
          console.log(`[WbApiClient] Лимит запросов (429) для downloadStocksReport. Повтор через ${retryInterval / 1000} секунд...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          continue // Повторяем запрос
        }

        throw error
      }
    }
  }
}

