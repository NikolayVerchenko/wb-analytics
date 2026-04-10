<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Загрузка данных</h2>
        <p class="page-description">
          {{ actionDescription }}
        </p>
      </div>

      <div class="sync-form-grid">
        <div class="field">
          <label for="sync-account">Кабинет</label>
          <select id="sync-account" v-model="form.accountId" class="field-select">
            <option value="">Выберите кабинет</option>
            <option v-for="account in accounts" :key="account.account_id" :value="account.account_id">
              {{ getAccountTitle(account) }}
            </option>
          </select>
        </div>

        <div v-if="showDateRangeFields" class="field">
          <label for="sync-date-from">Дата от</label>
          <input id="sync-date-from" v-model="form.dateFrom" type="date" />
        </div>

        <div v-if="showDateRangeFields" class="field">
          <label for="sync-date-to">Дата до</label>
          <input id="sync-date-to" v-model="form.dateTo" type="date" />
        </div>
      </div>

      <div class="sync-form-actions">
        <button
          v-if="jobId && canCancelJob"
          type="button"
          class="secondary-button"
          :disabled="cancelLoading"
          @click="handleCancelJob(jobId)"
        >
          {{ cancelLoading ? 'Останавливаю...' : 'Остановить' }}
        </button>

        <button
          v-if="jobId && hasFailedSteps"
          type="button"
          class="secondary-button"
          :disabled="retryFailedLoading"
          @click="handleRetryFailed(jobId)"
        >
          {{ retryFailedLoading ? 'Повторяю...' : 'Повторить проблемные шаги' }}
        </button>

      </div>

      <p class="sync-helper-text">
        Выберите кабинет. Во вкладке История догружаются только отстающие периоды относительно продаж, а полный период нужен только для технического режима.
      </p>

      <div v-if="createError" class="message message-error">{{ createError }}</div>
      <div v-else-if="createSuccessMessage" class="message message-info">{{ createSuccessMessage }}</div>
      <div v-if="retryFailedError" class="message message-error">{{ retryFailedError }}</div>
      <div v-if="cancelError" class="message message-error">{{ cancelError }}</div>
      <div v-if="restartError" class="message message-error">{{ restartError }}</div>

      <details class="sync-advanced-panel">
        <summary>Технические действия</summary>
        <div class="sync-form-actions sync-form-actions-advanced">
          <button
            type="button"
            class="secondary-button"
            :disabled="createLoading || !canSubmit"
            @click="handleContinueSalesJob"
          >
            {{ createLoading ? 'Создание job...' : 'Продолжить недельные данные' }}
          </button>

          <button
            type="button"
            class="secondary-button"
            :disabled="createLoading || !form.accountId"
            @click="handleCreateOpenWeekJob"
          >
            {{ createLoading ? 'Создание job...' : 'Обновить незакрытую неделю' }}
          </button>

          <button
            type="button"
            class="secondary-button"
            :disabled="createLoading || !canSubmit"
            @click="handleCreateFunnelJob"
          >
            {{ createLoading ? 'Создание job...' : 'Загрузить воронку продаж' }}
          </button>

          <button
            type="button"
            class="secondary-button"
            :disabled="createLoading || !canSubmit"
            @click="handleContinueFunnelJob"
          >
            {{ createLoading ? 'Создание job...' : 'Продолжить воронку продаж' }}
          </button>

          <button
            type="button"
            class="secondary-button"
            :disabled="createLoading || !form.accountId"
            @click="handleCreateStockSnapshotJob"
          >
            {{ createLoading ? 'Создание job...' : 'Обновить остатки сейчас' }}
          </button>

          <button
            v-if="jobId"
            type="button"
            class="secondary-button"
            :disabled="detailsLoading"
            @click="loadCurrentJob(jobId)"
          >
            Обновить статус
          </button>

          <button
            v-if="jobId && canRestartJob"
            type="button"
            class="secondary-button"
            :disabled="restartLoading"
            @click="handleRestartJob(jobId)"
          >
            {{ restartLoading ? 'Продолжаю...' : 'Продолжить' }}
          </button>
        </div>
      </details>
    </div>

    <div v-if="coverageLoading" class="message message-info">Обновляю доступность данных по кабинету...</div>
    <div v-else-if="coverageError" class="message message-error">{{ coverageError }}</div>

    <SyncCoverageOverview
      v-if="coverage"
      v-model:active-tab="selectedCoverageTab"
      :coverage="coverage"
      :create-loading="createLoading"
      :primary-action-label="primaryActionLabel"
      :primary-action-loading-label="primaryActionLoadingLabel"
      :primary-action-disabled="primaryActionDisabled"
      @primary-action="handlePrimaryAction"
      @history-gap-fill="handleHistoryGapFill"
    />

    <div v-if="detailsLoading" class="message message-info">Обновляю статус загрузки...</div>
    <div v-else-if="detailsError" class="message message-error">{{ detailsError }}</div>

    <details v-if="jobDetails" class="card sync-job-details-panel" :open="jobDetails.job.status === 'pending' || jobDetails.job.status === 'running'">
      <summary class="sync-job-details-summary">
        <span>Текущая загрузка</span>
        <span class="sync-status-pill sync-status-pill-small" :data-status="jobDetails.job.status">
          {{ jobStatusLabel }}
        </span>
      </summary>
      <div class="sync-job-details-body">
        <SyncJobProgress
          :job-details="jobDetails"
          :current-account-title="currentAccountTitle"
        />
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAccounts } from '../api/accounts'
import SyncCoverageOverview from '../components/SyncCoverageOverview.vue'
import SyncJobProgress from '../components/SyncJobProgress.vue'
import type { SyncDataset, SyncJobStatus } from '../types/sync'
import { useSyncJob } from '../composables/useSyncJob'
import type { Account } from '../types/account'

const route = useRoute()
const router = useRouter()
const accounts = ref<Account[]>([])
const SYNC_PAGE_STATE_KEY = 'sync-page-state'
type CoverageTab = 'overview' | 'historical' | 'operational' | 'reference'

const {
  jobDetails,
  coverage,
  createLoading,
  createError,
  createSuccessMessage,
  conflictJobId,
  detailsLoading,
  detailsError,
  coverageLoading,
  coverageError,
  retryFailedLoading,
  retryFailedError,
  cancelLoading,
  cancelError,
  restartLoading,
  restartError,
  createJob,
  continueJob,
  fillMissingHistory,
  loadJobDetails,
  loadCoverage,
  retryFailedJob,
  cancelJob,
  restartJob,
  startPolling,
  stopPolling,
} = useSyncJob()

const form = reactive({
  accountId: '',
  dateFrom: getDefaultDateFrom(),
  dateTo: getDefaultDateTo(),
})
const selectedCoverageTab = ref<CoverageTab>('overview')

const jobId = computed(() => (typeof route.query.job_id === 'string' ? route.query.job_id : ''))
const hasFailedSteps = computed(() => jobDetails.value?.steps.some((step) => step.status === 'failed') ?? false)
const canCancelJob = computed(() => {
  const status = jobDetails.value?.job.status
  return status === 'pending' || status === 'running'
})
const canRestartJob = computed(() => {
  const status = jobDetails.value?.job.status
  return status === 'cancelled' || status === 'failed' || status === 'partial_success'
})
const currentAccountTitle = computed(() => {
  const account = accounts.value.find((item) => item.account_id === form.accountId)
  return account ? getAccountTitle(account) : 'Не выбран'
})
const jobStatusLabel = computed(() => formatJobStatus(jobDetails.value?.job.status ?? 'pending'))
const canSubmit = computed(() => Boolean(form.accountId && form.dateFrom && form.dateTo))
const showDateRangeFields = computed(() => selectedCoverageTab.value === 'overview')
const primaryActionLabel = computed(() => {
  if (selectedCoverageTab.value === 'historical') {
    return 'Догрузить всё отставание'
  }
  if (selectedCoverageTab.value === 'operational') {
    return 'Обновить текущую неделю'
  }
  if (selectedCoverageTab.value === 'reference') {
    return 'Обновить остатки'
  }
  return 'Обновить данные'
})
const primaryActionLoadingLabel = computed(() => {
  if (selectedCoverageTab.value === 'historical') {
    return 'Ищу и запускаю догрузку...'
  }
  if (selectedCoverageTab.value === 'operational') {
    return 'Запускаю обновление недели...'
  }
  if (selectedCoverageTab.value === 'reference') {
    return 'Обновляю остатки...'
  }
  return 'Запускаю обновление...'
})
const primaryActionDisabled = computed(() => {
  if (createLoading.value) {
    return true
  }
  if (selectedCoverageTab.value === 'historical') {
    return !form.accountId || getHistoricalGapFillDatasets().length === 0
  }
  if (selectedCoverageTab.value === 'operational' || selectedCoverageTab.value === 'reference') {
    return !form.accountId
  }
  return !canSubmit.value
})
const actionDescription = computed(() => {
  if (selectedCoverageTab.value === 'historical') {
    return 'Продажи считаются опорой истории. Если реклама, приёмка или хранение отстают, догружайте только недостающие периоды относительно sales.'
  }
  if (selectedCoverageTab.value === 'operational') {
    return 'Запустите обновление незакрытой недели, чтобы подтянуть текущие продажи, воронку и связанные оперативные данные.'
  }
  if (selectedCoverageTab.value === 'reference') {
    return 'Обновляйте остатки отдельно. Карточки подтягиваются вместе с историей или оперативным обновлением.'
  }
  return 'Сначала выберите кабинет и тип данных ниже. Для истории задайте период, для оперативных и справочных данных достаточно кабинета.'
})
function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function getDefaultDateTo(): string {
  const today = new Date()
  const previousSunday = new Date(today)
  const day = previousSunday.getDay()
  const diffToPreviousSunday = day === 0 ? 7 : day
  previousSunday.setDate(previousSunday.getDate() - diffToPreviousSunday)
  return formatDate(previousSunday)
}

function getDefaultDateFrom(): string {
  const dateTo = new Date(getDefaultDateTo())
  const start = new Date(dateTo)
  start.setDate(start.getDate() - 7 * 51)
  return formatDate(start)
}

function getTodayDate(): string {
  return formatDate(new Date())
}

function getAccountTitle(account: Account): string {
  return account.seller_name || account.name || 'Без названия'
}

function formatJobStatus(status: SyncJobStatus): string {
  const labels: Record<SyncJobStatus, string> = {
    pending: 'Ожидает',
    running: 'В работе',
    success: 'Успешно',
    partial_success: 'Частично',
    failed: 'Ошибка',
    cancelled: 'Остановлено',
  }
  return labels[status]
}

function saveSyncPageState() {
  if (typeof window === 'undefined') {
    return
  }

  const currentJob = jobDetails.value?.job
  if (!currentJob) {
    return
  }

  window.localStorage.setItem(
    SYNC_PAGE_STATE_KEY,
    JSON.stringify({
      account_id: currentJob.account_id,
      job_id: currentJob.job_id,
      date_from: currentJob.date_from,
      date_to: currentJob.date_to,
    }),
  )
}

async function restoreSyncPageState() {
  if (typeof window === 'undefined') {
    return false
  }
  if (typeof route.query.job_id === 'string' && route.query.job_id) {
    return false
  }

  const raw = window.localStorage.getItem(SYNC_PAGE_STATE_KEY)
  if (!raw) {
    return false
  }

  try {
    const parsed = JSON.parse(raw) as {
      account_id?: string
      job_id?: string
      date_from?: string
      date_to?: string
    }

    if (!parsed.job_id) {
      return false
    }

    if (parsed.account_id) {
      form.accountId = parsed.account_id
    }
    if (parsed.date_from) {
      form.dateFrom = parsed.date_from
    }
    if (parsed.date_to) {
      form.dateTo = parsed.date_to
    }

    await router.replace({
      path: '/sync',
      query: {
        account_id: parsed.account_id || form.accountId,
        job_id: parsed.job_id,
      },
    })
    return true
  } catch {
    return false
  }
}

async function loadAccountsList() {
  try {
    accounts.value = await getAccounts()

    const routeAccountId = typeof route.query.account_id === 'string' ? route.query.account_id : ''
    if (routeAccountId) {
      form.accountId = routeAccountId
    }
  } catch {
    accounts.value = []
  }
}

async function loadCurrentJob(targetJobId: string) {
  const response = await loadJobDetails(targetJobId)

  if (response?.job.account_id) {
    form.accountId = response.job.account_id
    form.dateFrom = response.job.date_from
    form.dateTo = response.job.date_to
  }
}

async function handleCreateJob() {
  if (!canSubmit.value) {
    return
  }

  const response = await createJob({
    account_id: form.accountId,
    job_type: 'initial_sales_backfill',
    mode: 'weekly',
    date_from: form.dateFrom,
    date_to: form.dateTo,
    datasets: ['sales'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handlePrimaryAction() {
  if (selectedCoverageTab.value === 'operational') {
    await handleCreateOpenWeekJob()
    return
  }
  if (selectedCoverageTab.value === 'reference') {
    await handleCreateStockSnapshotJob()
    return
  }
  await handleFillMissingHistory()
}

function getHistoricalGapFillDatasets(): SyncDataset[] {
  const datasets = coverage.value?.historical.datasets ?? []
  return datasets
    .filter((dataset) => dataset.dataset !== 'sales' && dataset.missing_periods.length > 0)
    .map((dataset) => dataset.dataset as SyncDataset)
}

async function handleFillMissingHistory(datasets = getHistoricalGapFillDatasets()) {
  if (!form.accountId || datasets.length === 0) {
    return
  }

  const response = await fillMissingHistory({
    account_id: form.accountId,
    datasets,
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await loadCoverage(form.accountId, false)

  if (!response.job_id) {
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleHistoryGapFill(dataset: string) {
  await handleFillMissingHistory([dataset as SyncDataset])
}

async function handleContinueSalesJob() {
  if (!canSubmit.value) {
    return
  }

  const response = await continueJob({
    account_id: form.accountId,
    job_type: 'initial_sales_backfill',
    mode: 'weekly',
    date_from: form.dateFrom,
    date_to: form.dateTo,
    datasets: ['sales'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleCreateOpenWeekJob() {
  if (!form.accountId) {
    return
  }

  const today = getTodayDate()
  const response = await createJob({
    account_id: form.accountId,
    job_type: 'open_week_refresh',
    mode: 'daily',
    date_from: today,
    date_to: today,
    datasets: ['sales'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleCreateFunnelJob() {
  if (!canSubmit.value) {
    return
  }

  const response = await createJob({
    account_id: form.accountId,
    job_type: 'sales_funnel_backfill',
    mode: 'weekly',
    date_from: form.dateFrom,
    date_to: form.dateTo,
    datasets: ['sales_funnel'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleContinueFunnelJob() {
  if (!canSubmit.value) {
    return
  }

  const response = await continueJob({
    account_id: form.accountId,
    job_type: 'sales_funnel_backfill',
    mode: 'weekly',
    date_from: form.dateFrom,
    date_to: form.dateTo,
    datasets: ['sales_funnel'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleCreateStockSnapshotJob() {
  if (!form.accountId) {
    return
  }

  const snapshotDate = getTodayDate()
  const response = await createJob({
    account_id: form.accountId,
    job_type: 'stock_snapshot_refresh',
    mode: 'daily',
    date_from: snapshotDate,
    date_to: snapshotDate,
    datasets: ['warehouse_remains'],
  })

  if (!response) {
    if (conflictJobId.value) {
      await router.replace({
        path: '/sync',
        query: {
          account_id: form.accountId,
          job_id: conflictJobId.value,
        },
      })
    }
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

async function handleRetryFailed(targetJobId: string) {
  const response = await retryFailedJob(targetJobId)
  if (!response) {
    return
  }

  await loadCurrentJob(targetJobId)
  startPolling(targetJobId)
}

async function handleCancelJob(targetJobId: string) {
  const response = await cancelJob(targetJobId)
  if (!response) {
    return
  }

  await loadCurrentJob(targetJobId)
}

async function handleRestartJob(targetJobId: string) {
  const response = await restartJob(targetJobId)
  if (!response) {
    return
  }

  await router.replace({
    path: '/sync',
    query: {
      account_id: form.accountId,
      job_id: response.job_id,
    },
  })
}

watch(
  () => route.query.account_id,
  async (value) => {
    if (typeof value === 'string') {
      form.accountId = value
      await loadCoverage(value)
    }
  },
)

watch(
  () => form.accountId,
  async (value, previousValue) => {
    if (!value) {
      return
    }

    if (value === previousValue && coverage.value) {
      return
    }

    await loadCoverage(value)
  },
)

watch(
  () => route.query.job_id,
  async (value) => {
    if (typeof value === 'string' && value) {
      await loadCurrentJob(value)
      if (form.accountId) {
        await loadCoverage(form.accountId, false)
      }
      startPolling(value)
      return
    }

    stopPolling()
  },
  { immediate: true },
)

watch(
  () => jobDetails.value?.job,
  (job) => {
    if (job) {
      saveSyncPageState()
    }
  },
  { deep: true },
)

onMounted(async () => {
  await loadAccountsList()
  await restoreSyncPageState()
  if (form.accountId) {
    await loadCoverage(form.accountId)
  }
})
</script>
