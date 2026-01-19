import { ref } from 'vue'
import { useDI } from './useDependencyInjection'
import { DbCheckpointRepository } from '@/application/sync/DbCheckpointRepository'
import { DbLoadedPeriodRepository } from '@/application/sync/DbLoadedPeriodRepository'
import { DataFreshnessService } from '@/application/sync/DataFreshnessService'
import { defaultSyncPolicy } from '@/application/sync/SyncPolicy'
import { WbApiClient } from '@/api/WbApiClient'
import { WeeklyReportReadinessService } from '@/application/sync/WeeklyReportReadinessService'
import type { SyncContext } from '@/application/sync/SyncJob'
import type { DatasetKey } from '@/application/sync/types'
import { WeekSyncCoordinator } from '@/application/sync/WeekSyncCoordinator'
import { useAnalyticsStore } from '@/stores/analyticsStore'

export function useSyncData() {
  const di = useDI()
  const store = useAnalyticsStore()
  const isSyncing = ref(false)
  const progress = ref({ current: 0, total: 0 })
  const error = ref<Error | null>(null)

  const sync = async () => {
    isSyncing.value = true
    error.value = null
    progress.value = { current: 0, total: 0 }

    try {
      store.backfillProgress.isLoading = true
      store.backfillProgress.status = 'Синхронизация по неделям...'
      store.backfillProgress.error = null
      store.backfillProgress.result = null
      store.backfillProgress.progressInfo = null

      await runPrioritySyncStep((current, total, rangeLabel) => {
        progress.value = { current, total }
        store.backfillProgress.progressInfo = {
          current,
          total,
          currentWeek: rangeLabel,
          percentage: total > 0 ? Math.round((current / total) * 100) : 0,
          currentDataset: undefined,
        }
      })

      store.backfillProgress.status = 'Завершено'

      // Проверяем и обновляем API ключ из localStorage перед синхронизацией
      const apiKey = localStorage.getItem('wb_api_key')
      if (apiKey) {
        // Переинициализируем контейнер с актуальным ключом
        // Используем приведение типа, так как метод reinitialize существует, но не в типе
        const containerWithReinit = di as typeof di & { reinitialize: (key?: string) => void }
        if (typeof containerWithReinit.reinitialize === 'function') {
          containerWithReinit.reinitialize()
        }
      }

      return
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')
      store.backfillProgress.error = error.value.message
      throw err
    } finally {
      isSyncing.value = false
      store.backfillProgress.isLoading = false
      store.backfillProgress.progressInfo = null
    }
  }

  return {
    sync,
    isSyncing,
    progress,
    error,
  }
}

async function runPrioritySyncStep(
  onProgress?: (current: number, total: number, rangeLabel: string) => void
): Promise<void> {
  const apiKey = localStorage.getItem('wb_api_key')
  if (!apiKey) {
    return
  }

  const apiClient = new WbApiClient()
  apiClient.setApiKey(apiKey)

  const checkpointRepo = new DbCheckpointRepository()
  const loadedPeriodRepo = new DbLoadedPeriodRepository()

  const ctx: SyncContext = {
    checkpointRepo,
    loadedPeriodRepo,
    nowIso: () => new Date().toISOString().split('T')[0],
    apiClient,
    policy: defaultSyncPolicy,
  }

  const datasets: DatasetKey[] = [
    'returns',
    'logistics',
    'penalties',
    'sales',
    'advCosts',
    'storageCosts',
    'acceptanceCosts',
    'productOrders',
    'supplies',
  ]

  const coordinator = new WeekSyncCoordinator(ctx, apiClient, defaultSyncPolicy, datasets)
  const freshnessService = new DataFreshnessService(loadedPeriodRepo, defaultSyncPolicy, ctx.nowIso)
  const missingRanges = await freshnessService.getMissingRanges(datasets)
  const readinessService = new WeeklyReportReadinessService(apiClient, defaultSyncPolicy, ctx.nowIso)
  const readiness = await readinessService.checkSalesWeeklyReport()
  console.log(
    `[WeeklyReportReadiness] ready=${readiness.ready} reason=${readiness.reason} range=${readiness.range.from}..${readiness.range.to}`
  )
  const store = useAnalyticsStore()
  store.$patch({
    dataFreshness: {
      updatedAt: new Date().toISOString(),
      items: missingRanges.map(item => ({
        dataset: item.dataset,
        latestDate: item.latestDate ?? null,
        missingFrom: item.missingFrom ?? null,
        missingTo: item.missingTo ?? null,
      })),
    },
    weeklyReportReadiness: {
      ready: readiness.ready,
      checkedAt: readiness.checkedAt,
      range: readiness.range,
      reason: readiness.reason,
    },
  })
  for (const item of missingRanges) {
    if (!item.missingFrom || !item.missingTo) {
      console.log(`[Freshness] dataset=${item.dataset}: ok (latest=${item.latestDate ?? 'none'})`)
      continue
    }
    console.log(
      `[Freshness] dataset=${item.dataset}: latest=${item.latestDate ?? 'none'}, missing=${item.missingFrom}..${item.missingTo}`
    )
  }
  await coordinator.run(onProgress)
}
