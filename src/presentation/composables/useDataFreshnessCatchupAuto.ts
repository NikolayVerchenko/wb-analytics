import { ref } from 'vue'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { WbApiClient } from '@/api/WbApiClient'
import { DbCheckpointRepository } from '@/application/sync/DbCheckpointRepository'
import { DbLoadedPeriodRepository } from '@/application/sync/DbLoadedPeriodRepository'
import { DataFreshnessCatchupService } from '@/application/sync/DataFreshnessCatchupService'
import { defaultSyncPolicy } from '@/application/sync/SyncPolicy'
import type { SyncContext } from '@/application/sync/SyncJob'
import type { DatasetKey } from '@/application/sync/types'

export function useDataFreshnessCatchupAuto() {
  const analyticsStore = useAnalyticsStore()
  const isRunning = ref(false)

  const run = async () => {
    if (isRunning.value) {
      return
    }

    const apiKey = localStorage.getItem('wb_api_key')
    if (!apiKey) {
      return
    }

    isRunning.value = true

    try {
      analyticsStore.addStartupLog({ level: 'info', message: 'Свежесть: подготовка догрузки' })
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

      const service = new DataFreshnessCatchupService(ctx, apiClient, defaultSyncPolicy, datasets)
      const plan = await service.plan()

      analyticsStore.$patch({
        dataFreshness: {
          updatedAt: new Date().toISOString(),
          items: plan.missingRanges.map(item => ({
            dataset: item.dataset,
            latestDate: item.latestDate ?? null,
            missingFrom: item.missingFrom ?? null,
            missingTo: item.missingTo ?? null,
          })),
        },
      })

      if (!plan.rangeFrom || !plan.rangeTo) {
        analyticsStore.addStartupLog({ level: 'info', message: 'Свежесть: догрузка не требуется' })
        return
      }

      analyticsStore.addStartupLog({
        level: 'info',
        message: `Свежесть: догрузка ${plan.rangeFrom} - ${plan.rangeTo}`,
      })

      await service.run()

      if (!analyticsStore.isInitialLoading && !analyticsStore.isHistoryLoading) {
        await analyticsStore.loadAllDataFromDb()
      }

      analyticsStore.addStartupLog({ level: 'info', message: 'Свежесть: догрузка завершена' })
    } finally {
      isRunning.value = false
    }
  }

  return {
    start: run,
  }
}
