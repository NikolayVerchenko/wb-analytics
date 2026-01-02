/**
 * DIContainer - очищен для новой реализации
 * Будет заполнен при новой реализации по принципам Clean Architecture
 */
// TODO: Восстановить после реализации LoggerService
// import { WBApiClient } from '@infrastructure/api/wbApiClient'

// Простая заглушка для logger
const loggerStub = {
  add: (level: string, message: string) => {
    console.log(`[${level}] ${message}`)
  }
}

export class DIContainer {
  private static instance: DIContainer
  // private apiClient: WBApiClient | null = null

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
  }

  // TODO: Восстановить после реализации WBApiClient с новой архитектурой
  // initialize(apiKey: string): void {
  //   this.apiClient = new WBApiClient({ 
  //     apiKey, 
  //     logger: loggerStub as any
  //   })
  // }

  // Геттеры будут добавлены при новой реализации
  // getApiClient(): WBApiClient {
  //   if (!this.apiClient) {
  //     throw new Error('DIContainer not initialized. Call initialize() first.')
  //   }
  //   return this.apiClient
  // }
}

export const container = DIContainer.getInstance()
