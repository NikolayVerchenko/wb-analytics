import { computed, unref, type MaybeRef } from 'vue'
import type { SyncJobDetailsResponse, SyncJobStatus, SyncJobStep, SyncJobStepStatus } from '../types/sync'

export type SyncStatusCount = {
  pending: number
  running: number
  success: number
  failed: number
  skipped: number
  cancelled: number
}

export type SyncRateLimitStats = {
  step429Count: number
  last429At: string | null
  last429Week: string | null
}

export type SyncWeekProgressItem = {
  periodFrom: string
  periodTo: string
  totalSteps: number
  counts: SyncStatusCount
  statuses: SyncJobStepStatus[]
  steps: SyncJobStep[]
  errorMessages: string[]
  retryMessage: string | null
  blockReasonMessage: string | null
  phaseMessage: string | null
  phaseDetailMessage: string | null
  phaseElapsedMessage: string | null
  apiHintMessage: string | null
}

export function useSyncJobProgress(jobDetails: MaybeRef<SyncJobDetailsResponse | null>) {
  const steps = computed(() => unref(jobDetails)?.steps ?? [])

  const counts = computed<SyncStatusCount>(() => {
    const summary: SyncStatusCount = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      cancelled: 0,
    }

    for (const step of steps.value) {
      summary[step.status] += 1
    }

    return summary
  })

  const totalSteps = computed(() => steps.value.length)
  const completedSteps = computed(() => counts.value.success + counts.value.failed + counts.value.skipped + counts.value.cancelled)
  const progressPercent = computed(() => {
    if (totalSteps.value === 0) {
      return 0
    }

    return Math.round((completedSteps.value / totalSteps.value) * 100)
  })

  const weeklyProgress = computed<SyncWeekProgressItem[]>(() => {
    const grouped = new Map<string, SyncWeekProgressItem>()

    for (const step of steps.value) {
      const key = `${step.period_from}:${step.period_to}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          periodFrom: step.period_from,
          periodTo: step.period_to,
          totalSteps: 0,
          counts: {
            pending: 0,
            running: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            cancelled: 0,
          },
          statuses: [],
          steps: [],
          errorMessages: [],
          retryMessage: null,
          blockReasonMessage: null,
          phaseMessage: null,
          phaseDetailMessage: null,
          phaseElapsedMessage: null,
          apiHintMessage: null,
        })
      }

      const week = grouped.get(key)!
      week.totalSteps += 1
      week.counts[step.status] += 1
      week.statuses.push(step.status)
      week.steps.push(step)
      if (step.error_message) {
        week.errorMessages.push(normalizeSyncErrorMessage(step.error_message))
      }
      if (step.next_retry_at) {
        week.retryMessage = formatRetryMessage(step.next_retry_at)
      }
      if (step.next_retry_at && step.error_message) {
        week.blockReasonMessage = buildBlockReasonMessage(step.error_message)
      }
      const phase = typeof step.payload_json?.phase === 'string' ? step.payload_json.phase : null
      const phaseLabel = typeof step.payload_json?.phase_label === 'string' ? step.payload_json.phase_label : null
      const phaseDetail = typeof step.payload_json?.phase_detail === 'string' ? step.payload_json.phase_detail : null
      if (step.status === 'running' && phaseLabel) {
        week.phaseMessage = `Сейчас: ${phaseLabel}`
      }
      if (step.status === 'running' && phaseDetail) {
        week.phaseDetailMessage = phaseDetail
      }
      if (step.status === 'running' && step.started_at) {
        const diagnostics = buildRunningDiagnostics(step.started_at, phase)
        week.phaseElapsedMessage = diagnostics.elapsedMessage
        week.apiHintMessage = diagnostics.hintMessage
      }
    }

    return Array.from(grouped.values())
  })

  const jobStatusLabel = computed(() => formatJobStatus(unref(jobDetails)?.job.status ?? 'pending'))
  const rateLimitStats = computed<SyncRateLimitStats>(() => {
    let step429Count = 0
    let last429At: string | null = null
    let last429Week: string | null = null

    for (const step of steps.value) {
      if (step.error_message && isRateLimitMessage(step.error_message)) {
        step429Count += 1
        if (step.next_retry_at) {
          const retryAt = new Date(step.next_retry_at)
          const currentLast = last429At ? new Date(last429At) : null
          if (!Number.isNaN(retryAt.getTime()) && (!currentLast || retryAt > currentLast)) {
            last429At = step.next_retry_at
            last429Week = `${step.period_from} - ${step.period_to}`
          }
        } else if (!last429Week) {
          last429Week = `${step.period_from} - ${step.period_to}`
        }
      }
    }

    return {
      step429Count,
      last429At: last429At ? formatDateTime(last429At) : null,
      last429Week,
    }
  })

  return {
    counts,
    totalSteps,
    completedSteps,
    progressPercent,
    weeklyProgress,
    jobStatusLabel,
    rateLimitStats,
  }
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

function formatRetryMessage(nextRetryAt: string): string {
  const value = new Date(nextRetryAt)
  if (Number.isNaN(value.getTime())) {
    return 'Будет повторная попытка позже'
  }

  return `Следующая попытка после ${formatDateTime(nextRetryAt)}`
}

function buildBlockReasonMessage(errorMessage: string): string | null {
  const lowered = errorMessage.toLowerCase()
  if (!(lowered.includes('too many requests') || lowered.includes('limited by global limiter') || /\b429\b/.test(errorMessage))) {
    return null
  }

  if (lowered.includes('page_rows=') || lowered.includes('rrdid=') || lowered.includes('status=200')) {
    return 'WB ограничил следующую страницу weekly-отчёта. Дальше по неделям не идём, пока эта неделя не догрузится полностью.'
  }

  return 'WB ограничил weekly-запрос по этой неделе. Дальше по неделям не идём, пока эта неделя не загрузится.'
}

function buildRunningDiagnostics(startedAt: string, phase: string | null): { elapsedMessage: string | null; hintMessage: string | null } {
  const started = new Date(startedAt)
  if (Number.isNaN(started.getTime())) {
    return { elapsedMessage: null, hintMessage: null }
  }

  const elapsedMs = Date.now() - started.getTime()
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
  const elapsedMessage = `В этой фазе уже ${elapsedMinutes}м ${elapsedSeconds}с`

  if (phase !== 'raw') {
    return { elapsedMessage, hintMessage: null }
  }

  if (elapsedMs >= 180000) {
    return {
      elapsedMessage,
      hintMessage: 'WB API отвечает дольше 3 минут. Вероятная причина: медленный внешний ответ или ограничение rate limit/429, но точная причина станет известна только после ответа WB.',
    }
  }

  if (elapsedMs >= 60000) {
    return {
      elapsedMessage,
      hintMessage: 'WB API отвечает дольше минуты. Это часто означает медленный внешний ответ и иногда заканчивается rate limit/429.',
    }
  }

  return { elapsedMessage, hintMessage: null }
}

function normalizeSyncErrorMessage(message: string): string {
  const lowered = message.toLowerCase()

  if (isRateLimitMessage(message)) {
    return 'WB API временно ограничил запросы. Попробуем повторить позже.'
  }

  if (/\b(500|502|503|504)\b/.test(message)) {
    return 'WB API временно недоступен. Это похоже на ошибку на стороне Wildberries.'
  }

  if (lowered.includes('timeout') || lowered.includes('timed out')) {
    return 'WB API слишком долго отвечает. Попробуем повторить позже.'
  }

  if (lowered.includes('duplicate key value') || lowered.includes('on conflict')) {
    return 'Шаг столкнулся с повторяющимися данными. После обновления загрузчика его можно безопасно запустить повторно.'
  }

  if (lowered.startsWith('command failed with exit code 1:')) {
    const stderrMatch = message.match(/stderr:\s*([\s\S]*?)(?:\s*stdout:|$)/i)
    if (stderrMatch && stderrMatch[1]?.trim()) {
      return normalizeSyncErrorMessage(stderrMatch[1].trim())
    }

    return 'Один из загрузчиков завершился ошибкой. Откройте детали или повторите проблемный шаг позже.'
  }

  const statusTextMatch = message.match(/statusText["']?\s*[:=]\s*["']([^"']+)["']/i)
  const statusMatch = message.match(/\bstatus["']?\s*[:=]\s*(429|500|502|503|504)\b/i)
  if (statusMatch) {
    const suffix = statusTextMatch ? ` ${statusTextMatch[1]}` : ''
    return `WB API: ${statusMatch[1]}${suffix}`
  }

  return message.length > 220 ? `${message.slice(0, 220)}...` : message
}

function isRateLimitMessage(message: string): boolean {
  const lowered = message.toLowerCase()
  return lowered.includes('too many requests') || lowered.includes('limited by global limiter') || /\b429\b/.test(message)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU')
}
