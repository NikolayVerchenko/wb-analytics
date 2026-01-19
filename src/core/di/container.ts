import { TOKENS } from './tokens'
import { db } from '@/db/db'
import axios from 'axios'
import { DatabaseRepository } from '@/infrastructure/repositories/DatabaseRepository'
import { WBApiClient } from '@/infrastructure/api/wbApiClient'
import { DataLoadingService } from '@/application/services/DataLoadingService'
import { ReportAggregationService } from '@/application/services/ReportAggregationService'
import { SupplyService } from '@/application/services/SupplyService'
import type { IDatabaseRepository } from '@/core/domain/repositories/IDatabaseRepository'
import type { IWBApiClient } from '@/core/domain/repositories/IWBApiClient'

/**
 * Minimal Dependency Injection Container
 */
export class DIContainer {
  private static instance: DIContainer
  private registry: Map<symbol, () => any> = new Map()
  private instances: Map<symbol, any> = new Map()

  private constructor() {
    this.build()
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer()
    }
    return DIContainer.instance
  }

  /**
   * Register a factory function for a token
   */
  register<T>(token: symbol, factory: () => T): void {
    this.registry.set(token, factory)
  }

  /**
   * Resolve an instance for a token (with singleton caching)
   */
  resolve<T>(token: symbol): T {
    // Return cached instance if available
    if (this.instances.has(token)) {
      return this.instances.get(token) as T
    }

    // Get factory from registry
    const factory = this.registry.get(token)
    if (!factory) {
      throw new Error(`No factory registered for token: ${token.toString()}`)
    }

    // Create instance and cache it
    const instance = factory() as T
    this.instances.set(token, instance)
    return instance
  }

  /**
   * Build and register all services
   */
  build(): void {
    // Get apiKey from localStorage
    const apiKey = localStorage.getItem('wb_api_key') || ''
    const proxyUrl = import.meta.env.VITE_PROXY_URL

    // 1. Register databaseRepository
    this.register(TOKENS.databaseRepository, () => {
      return new DatabaseRepository(db)
    })

    // 2. Register wbApiClient
    this.register(TOKENS.wbApiClient, () => {
      return new WBApiClient(axios.create(), apiKey, proxyUrl)
    })

    // 3. Register dataLoadingService
    this.register(TOKENS.dataLoadingService, () => {
      return new DataLoadingService(this.resolve<IDatabaseRepository>(TOKENS.databaseRepository))
    })

    // 4. Register reportAggregationService
    this.register(TOKENS.reportAggregationService, () => {
      return new ReportAggregationService(this.resolve<IDatabaseRepository>(TOKENS.databaseRepository))
    })

    // 5. Register supplyService
    this.register(TOKENS.supplyService, () => {
      return new SupplyService(
        this.resolve<IWBApiClient>(TOKENS.wbApiClient),
        this.resolve<IDatabaseRepository>(TOKENS.databaseRepository)
      )
    })
  }

  /**
   * Reinitialize: clear registry and instances, then rebuild
   */
  reinitialize(): void {
    this.registry.clear()
    this.instances.clear()
    this.build()
  }
}

export const container = DIContainer.getInstance()
