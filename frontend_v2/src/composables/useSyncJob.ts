import { computed, onBeforeUnmount, ref } from 'vue'
import { cancelSyncJob, continueSyncJob, createSyncJob, getSyncJob, restartSyncJob, resumeReadySyncJob, retryFailedSyncJob, runSyncJob } from '../api/sync'
import type { SyncJobCreate, SyncJobDetailsResponse } from '../types/sync'

export function useSyncJob() {
  const jobDetails = ref<SyncJobDetailsResponse | null>(null)
  const createLoading = ref(false)
  const createError = ref('')
  const createSuccessMessage = ref('')
  const conflictJobId = ref('')
  const detailsLoading = ref(false)
  const detailsError = ref('')
  const runLoading = ref(false)
  const runError = ref('')
  const retryFailedLoading = ref(false)
  const retryFailedError = ref('')
  const cancelLoading = ref(false)
  const cancelError = ref('')
  const restartLoading = ref(false)
  const restartError = ref('')

  let pollingTimer: number | null = null
  let resumeInFlight = false
  let lastResumeKey = ''

  const isTerminalStatus = computed(() => {
    const status = jobDetails.value?.job.status
    return status === 'success' || status === 'failed' || status === 'partial_success' || status === 'cancelled'
  })

  function stopPolling() {
    if (pollingTimer !== null) {
      window.clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  function getDueRetryKey(details: SyncJobDetailsResponse | null): string {
    if (!details || details.job.status !== 'running') {
      return ''
    }

    const now = Date.now()
    const dueStep = details.steps.find((step) => {
      if (step.status !== 'pending' || !step.next_retry_at) {
        return false
      }
      return new Date(step.next_retry_at).getTime() <= now
    })

    if (!dueStep || !dueStep.next_retry_at) {
      return ''
    }

    return `${details.job.job_id}:${dueStep.step_id}:${dueStep.next_retry_at}`
  }

  async function resumeReadyJob(jobId: string) {
    if (!jobId || resumeInFlight) {
      return null
    }

    resumeInFlight = true
    try {
      const response = await resumeReadySyncJob(jobId)
      jobDetails.value = response
      return response
    } catch {
      return null
    } finally {
      resumeInFlight = false
    }
  }

  async function loadJobDetails(jobId: string, showLoading = true) {
    if (!jobId) {
      return null
    }

    if (showLoading) {
      detailsLoading.value = true
    }
    detailsError.value = ''

    try {
      const response = await getSyncJob(jobId)
      jobDetails.value = response

      if (response.job.status === 'success' || response.job.status === 'failed' || response.job.status === 'partial_success' || response.job.status === 'cancelled') {
        stopPolling()
      }

      const dueRetryKey = getDueRetryKey(response)
      if (dueRetryKey && dueRetryKey !== lastResumeKey) {
        lastResumeKey = dueRetryKey
        void resumeReadyJob(jobId)
      } else if (!dueRetryKey) {
        lastResumeKey = ''
      }

      return response
    } catch (error) {
      detailsError.value = error instanceof Error ? error.message : 'Не удалось загрузить статус job.'
      return null
    } finally {
      if (showLoading) {
        detailsLoading.value = false
      }
    }
  }

  async function createJob(payload: SyncJobCreate) {
    createLoading.value = true
    createError.value = ''
    createSuccessMessage.value = ''
    conflictJobId.value = ''

    try {
      const response = await createSyncJob(payload)
      createSuccessMessage.value = `Job создана: ${response.job_id}`
      return response
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Не удалось создать sync job.'
      conflictJobId.value = extractConflictJobId(createError.value)
      return null
    } finally {
      createLoading.value = false
    }
  }

  async function continueJob(payload: SyncJobCreate) {
    createLoading.value = true
    createError.value = ''
    createSuccessMessage.value = ''
    conflictJobId.value = ''

    try {
      const response = await continueSyncJob(payload)
      createSuccessMessage.value = `Job продолжения создана: ${response.job_id}`
      return response
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Не удалось продолжить загрузку.'
      conflictJobId.value = extractConflictJobId(createError.value)
      return null
    } finally {
      createLoading.value = false
    }
  }

  async function runJob(jobId: string, maxSteps = 1) {
    if (!jobId) {
      return null
    }

    runLoading.value = true
    runError.value = ''

    try {
      const response = await runSyncJob(jobId, { max_steps: maxSteps })
      jobDetails.value = response

      if (response.job.status !== 'success' && response.job.status !== 'failed' && response.job.status !== 'partial_success' && response.job.status !== 'cancelled') {
        startPolling(jobId)
      }

      return response
    } catch (error) {
      runError.value = error instanceof Error ? error.message : 'Не удалось запустить обработку job.'
      return null
    } finally {
      runLoading.value = false
    }
  }

  async function retryFailedJob(jobId: string) {
    if (!jobId) {
      return null
    }

    retryFailedLoading.value = true
    retryFailedError.value = ''

    try {
      const response = await retryFailedSyncJob(jobId)
      jobDetails.value = response
      startPolling(jobId)
      return response
    } catch (error) {
      retryFailedError.value = error instanceof Error ? error.message : 'Не удалось повторно запустить ошибочные недели.'
      return null
    } finally {
      retryFailedLoading.value = false
    }
  }

  async function cancelJob(jobId: string) {
    if (!jobId) {
      return null
    }

    cancelLoading.value = true
    cancelError.value = ''

    try {
      const response = await cancelSyncJob(jobId)
      jobDetails.value = response
      stopPolling()
      return response
    } catch (error) {
      cancelError.value = error instanceof Error ? error.message : 'Не удалось остановить загрузку.'
      return null
    } finally {
      cancelLoading.value = false
    }
  }

  async function restartJob(jobId: string) {
    if (!jobId) {
      return null
    }

    restartLoading.value = true
    restartError.value = ''

    try {
      const response = await restartSyncJob(jobId)
      return response
    } catch (error) {
      restartError.value = error instanceof Error ? error.message : 'Не удалось перезапустить загрузку.'
      return null
    } finally {
      restartLoading.value = false
    }
  }

  function extractConflictJobId(message: string): string {
    const match = message.match(/job_id=([0-9a-f-]{36})/i)
    return match ? match[1] : ''
  }

  function startPolling(jobId: string) {
    stopPolling()

    if (!jobId) {
      return
    }

    pollingTimer = window.setInterval(() => {
      if (!jobId || detailsLoading.value || isTerminalStatus.value) {
        return
      }

      void loadJobDetails(jobId, false)
    }, 5000)
  }

  onBeforeUnmount(stopPolling)

  return {
    jobDetails,
    createLoading,
    createError,
    createSuccessMessage,
    conflictJobId,
    detailsLoading,
    detailsError,
    runLoading,
    runError,
    retryFailedLoading,
    retryFailedError,
    cancelLoading,
    cancelError,
    restartLoading,
    restartError,
    createJob,
    continueJob,
    loadJobDetails,
    runJob,
    retryFailedJob,
    cancelJob,
    restartJob,
    startPolling,
    stopPolling,
  }
}
