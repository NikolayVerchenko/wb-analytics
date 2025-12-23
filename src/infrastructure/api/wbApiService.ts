import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import type { LoggerService } from '@application/services/LoggerService'

/**
 * Интерфейс для конфигурации запроса с retry логикой
 */
export interface RequestWithRetryConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, any>
  headers?: Record<string, string>
  data?: any
    onRetry?: (retryCount: number) => void // Callback при получении 429 или сетевых ошибок
}

/**
 * Низкоуровневый сервис для работы с API Wildberries
 * Обрабатывает ошибки 429 (Too Many Requests) и сетевые ошибки с бесконечными повторами
 */
export class WbApiService {
  private client: AxiosInstance
  private apiKey: string
  private logger: LoggerService

  constructor(apiKey: string, baseURL: string, logger: LoggerService) {
    this.apiKey = apiKey
    this.logger = logger
    
    // Определяем, используется ли прокси (если baseURL указывает на localhost:3000, значит прокси)
    const isProxy = baseURL.includes('localhost:3000') || baseURL.includes('127.0.0.1:3000')
    
    // Если используется прокси, передаем ключ в заголовке X-WB-API-Key
    // Иначе используем стандартный Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (isProxy) {
      headers['X-WB-API-Key'] = apiKey
    } else {
      headers['Authorization'] = apiKey
    }
    
    this.client = axios.create({
      baseURL,
      headers,
    })
  }

  /**
   * Базовый метод для выполнения запросов с retry логикой для ошибки 429
   * 
   * Логика работы:
   * - Успешный запрос (200): возвращает данные, делает паузу 10 секунд
   * - Ошибка 429 (Too Many Requests): выводит статус, ждет 10 секунд, повторяет бесконечно
   * - Другие ошибки (401, 500 и т.д.): прерывает цикл и выбрасывает исключение
   * 
   * @param config Конфигурация запроса
   * @returns Данные ответа API
   * @throws AxiosError для всех ошибок кроме 429
   */
  async requestWithRetry<T = any>(config: RequestWithRetryConfig): Promise<T> {
    const { onRetry } = config
    let retryCount = 0

    while (true) {
      try {
        const requestConfig: AxiosRequestConfig = {
          method: config.method || 'GET',
          url: config.url,
          params: config.params,
          headers: config.headers,
          data: config.data,
        }

        const response = await this.client.request<T>(requestConfig)

        // Успешный запрос (status 200): возвращаем данные и делаем паузу 10 секунд
        if (response.status === 200) {
          const data = response.data
          // Пауза после успешного запроса для соблюдения rate limits
          // Пользователь запросил 10 секунд
          await this.sleep(10000)
          return data
        }

        // Если статус не 200 (маловероятно, но на всякий случай)
        return response.data
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError
          const status = axiosError.response?.status
          const errorCode = axiosError.code

          // Определяем, является ли это сетевой ошибкой
          const isNetworkError = !axiosError.response || 
                                 errorCode === 'ERR_NETWORK' || 
                                 errorCode === 'ERR_CONNECTION_CLOSED' ||
                                 errorCode === 'ECONNABORTED' ||
                                 errorCode === 'ETIMEDOUT'

          // Ошибка 429 (Too Many Requests): повторяем запрос бесконечно
          const is429 = status === 429

          // Фатальные ошибки: прерываем цикл (401, 403)
          const isFatalError = status === 401 || status === 403

          // Повторяем при сетевых ошибках или 429
          if (isNetworkError || is429) {
            retryCount++
            
            // Уведомляем через callback о повторе
            if (onRetry) {
              onRetry(retryCount)
            }

            if (isNetworkError) {
              this.logger.add('warn', `Проблема с сетью (${errorCode || 'Network Error'}). Ожидание 10 сек...`, { attempt: retryCount })
            } else {
              this.logger.add('warn', 'Лимит запросов WB (429). Ожидание 10 сек...', { attempt: retryCount })
            }

            // Ждем 10 секунд перед повтором
            await this.sleep(10000)

            // Продолжаем цикл (бесконечный retry для сетевых ошибок и 429)
            continue
          }

          // Фатальные ошибки (401, 403) - прерываем цикл и выбрасываем исключение
          if (isFatalError) {
            const errorMessage = status === 401 
              ? 'Ошибка авторизации (401): проверьте токен API'
              : `Ошибка доступа (${status}): ${axiosError.message}`
            this.logger.add('error', errorMessage, { status, url: config.url })
            throw axiosError
          }

          // Для остальных HTTP ошибок (500 и т.д.) - тоже пробрасываем
          // (можно добавить retry и для них, если нужно, но по умолчанию прерываем)
          const errorDetails = {
            status: status || errorCode,
            message: axiosError.message,
            url: axiosError.config?.url,
            method: axiosError.config?.method,
            responseData: axiosError.response?.data,
          }
          console.error(`[WbApiService] Ошибка API:`, errorDetails)
          this.logger.add('error', `Ошибка API (${status || errorCode}): ${axiosError.message}`, errorDetails)
          throw axiosError
        }

        // Если это не AxiosError, пробрасываем как есть
        throw error
      }
    }
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Обновляет API ключ
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    
    // Определяем, используется ли прокси
    const baseURL = this.client.defaults.baseURL || ''
    const isProxy = baseURL.includes('localhost:3000') || baseURL.includes('127.0.0.1:3000')
    
    if (isProxy) {
      this.client.defaults.headers['X-WB-API-Key'] = apiKey
      delete this.client.defaults.headers['Authorization']
    } else {
      this.client.defaults.headers['Authorization'] = apiKey
      delete this.client.defaults.headers['X-WB-API-Key']
    }
  }
}
