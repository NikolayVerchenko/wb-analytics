import type { DatasetKey } from './types'
import type { SyncJob } from './SyncJob'
import type { SyncContext } from './SyncJob'
import type { SyncPolicy, DatasetPolicy } from './SyncPolicy'
import { SyncRunner } from './SyncRunner'
import { SyncOrchestrator, type OrchestratorOptions } from './SyncOrchestrator'
import type { WbApiClient } from '../../api/WbApiClient'
import { SalesSyncJob } from './jobs/SalesSyncJob'
import { ReturnsSyncJob } from './jobs/ReturnsSyncJob'
import { LogisticsSyncJob } from './jobs/LogisticsSyncJob'
import { PenaltiesSyncJob } from './jobs/PenaltiesSyncJob'
import { AdvCostsSyncJob } from './jobs/AdvCostsSyncJob'
import { StorageCostsSyncJob } from './jobs/StorageCostsSyncJob'
import { AcceptanceCostsSyncJob } from './jobs/AcceptanceCostsSyncJob'
import { ProductOrdersSyncJob } from './jobs/ProductOrdersSyncJob'
import { SuppliesSyncJob } from './jobs/SuppliesSyncJob'

/**
 * Реестр всех SyncJob и фабрика для создания SyncRunner и SyncOrchestrator
 */
export class SyncRegistry {
  /**
   * Создает все зарегистрированные jobs
   */
  static buildJobs(
    ctx: SyncContext,
    apiClient: WbApiClient,
    policy: SyncPolicy
  ): Record<DatasetKey, SyncJob> {
    const jobs: Partial<Record<DatasetKey, SyncJob>> = {}

    // Финансовые таблицы из fetchReportPage
    jobs.sales = new SalesSyncJob(apiClient, policy.sales)
    jobs.returns = new ReturnsSyncJob(apiClient, policy.returns)
    jobs.logistics = new LogisticsSyncJob(apiClient, policy.logistics)
    jobs.penalties = new PenaltiesSyncJob(apiClient, policy.penalties)

    // Рекламные расходы
    jobs.advCosts = new AdvCostsSyncJob(apiClient, policy.advCosts)
    
    // Расходы на хранение и приёмку (асинхронные задачи)
    jobs.storageCosts = new StorageCostsSyncJob(apiClient, policy.storageCosts)
    jobs.acceptanceCosts = new AcceptanceCostsSyncJob(apiClient, policy.acceptanceCosts)
    
    // Статистика заказов
    jobs.productOrders = new ProductOrdersSyncJob(apiClient, policy.productOrders)
    
    // Поставки (требуют специальной логики через SupplyService)
    jobs.supplies = new SuppliesSyncJob(apiClient, policy.supplies)

    return jobs as Record<DatasetKey, SyncJob>
  }

  /**
   * Создает SyncRunner с зарегистрированными jobs
   */
  static createRunner(
    ctx: SyncContext,
    apiClient: WbApiClient,
    policy: SyncPolicy
  ): SyncRunner {
    const jobs = this.buildJobs(ctx, apiClient, policy)
    return new SyncRunner(ctx, jobs)
  }

  /**
   * Создает SyncOrchestrator
   */
  static createOrchestrator(
    ctx: SyncContext,
    apiClient: WbApiClient,
    policy: SyncPolicy,
    opts: OrchestratorOptions
  ): SyncOrchestrator {
    const jobs = this.buildJobs(ctx, apiClient, policy)
    const runner = new SyncRunner(ctx, jobs)
    return new SyncOrchestrator(ctx, runner, policy, opts, jobs, apiClient)
  }
}
