import { ref, onBeforeUnmount } from 'vue'
import { WbApiClient } from '@/api/WbApiClient'
import { defaultSyncPolicy } from '@/application/sync/SyncPolicy'
import { WeeklyReportAutoSyncService } from '@/application/sync/WeeklyReportAutoSyncService'
import { useAnalyticsStore } from '@/stores/analyticsStore'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

const getNowIso = (): string => new Date().toISOString().split('T')[0]

const getNextMondayMidnight = (): Date => {
  const now = new Date()
  const day = now.getDay()
  const daysToMonday = (8 - (day === 0 ? 7 : day)) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + daysToMonday)
  next.setHours(0, 0, 0, 0)
  return next
}

export function useWeeklyReportAutoSync() {
  const analyticsStore = useAnalyticsStore()
  const isRunning = ref(false)
  const isRefreshing = ref(false)
  let intervalId: number | null = null
  let restartTimeoutId: number | null = null

  const stopInterval = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  const scheduleNextMondayRestart = () => {
    if (restartTimeoutId !== null) {
      clearTimeout(restartTimeoutId)
    }
    const nextMonday = getNextMondayMidnight()
    const delay = Math.max(nextMonday.getTime() - Date.now(), 0)
    restartTimeoutId = window.setTimeout(() => {
      start()
    }, delay)
  }

  const runCheck = async () => {
    if (isRunning.value) {
      return
    }

    const apiKey = localStorage.getItem('wb_api_key')
    if (!apiKey) {
      analyticsStore.$patch({
        weeklyReportReadiness: {
          ready: false,
          checkedAt: new Date().toISOString(),
          range: null,
          reason: 'no-api-key',
        },
        weeklyReportAutoSync: {
          running: false,
          lastRunAt: new Date().toISOString(),
          lastSyncAt: analyticsStore.weeklyReportAutoSync.lastSyncAt,
          status: 'no-api-key',
        },
      })
      return
    }

    isRunning.value = true
    analyticsStore.$patch({
      weeklyReportAutoSync: {
        running: true,
        lastRunAt: new Date().toISOString(),
        lastSyncAt: analyticsStore.weeklyReportAutoSync.lastSyncAt,
        status: 'checking',
      },
    })
    try {
      const apiClient = new WbApiClient()
      apiClient.setApiKey(apiKey)

      const service = new WeeklyReportAutoSyncService(apiClient, defaultSyncPolicy, getNowIso)
      const result = await service.checkAndSync()

      analyticsStore.$patch({
        weeklyReportReadiness: {
          ready: result.readiness.ready,
          checkedAt: result.readiness.checkedAt,
          range: result.readiness.range,
          reason: result.readiness.reason,
        },
        weeklyReportAutoSync: {
          running: true,
          lastRunAt: new Date().toISOString(),
          lastSyncAt:
            result.state === 'synced'
              ? new Date().toISOString()
              : analyticsStore.weeklyReportAutoSync.lastSyncAt,
          status: result.state,
        },
      })

      if (result.state === 'synced' || result.state === 'already-loaded') {
        if (!isRefreshing.value && !analyticsStore.isInitialLoading && !analyticsStore.isHistoryLoading) {
          isRefreshing.value = true
          try {
            await analyticsStore.loadAllDataFromDb()
          } finally {
            isRefreshing.value = false
          }
        }
        stopInterval()
        scheduleNextMondayRestart()
      }
    } finally {
      isRunning.value = false
      analyticsStore.$patch({
        weeklyReportAutoSync: {
          running: false,
          lastRunAt: analyticsStore.weeklyReportAutoSync.lastRunAt,
          lastSyncAt: analyticsStore.weeklyReportAutoSync.lastSyncAt,
          status: analyticsStore.weeklyReportAutoSync.status,
        },
      })
    }
  }

  const start = () => {
    stopInterval()
    runCheck()
    intervalId = window.setInterval(runCheck, CHECK_INTERVAL_MS)
  }

  const stop = () => {
    stopInterval()
    if (restartTimeoutId !== null) {
      clearTimeout(restartTimeoutId)
      restartTimeoutId = null
    }
  }

  onBeforeUnmount(() => {
    stop()
  })

  return {
    start,
    stop,
  }
}
