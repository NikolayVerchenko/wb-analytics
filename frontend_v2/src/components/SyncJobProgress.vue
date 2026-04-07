<template>
  <section v-if="jobDetails" class="card stack">
    <div class="sync-job-header">
      <div>
        <h3 class="section-title">Текущая job</h3>
        <p class="sync-job-id">{{ jobDetails.job.job_id }}</p>
      </div>
      <span class="sync-status-pill" :data-status="jobDetails.job.status">
        {{ jobStatusLabel }}
      </span>
    </div>

    <div class="sync-progress-block">
      <div class="sync-progress-meta">
        <span>Обработано {{ completedSteps }} из {{ totalSteps }} недель</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <div class="sync-progress-track">
        <div class="sync-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
    </div>

    <div class="sync-summary-grid sync-status-summary-grid">
      <div class="totals-item">
        <span class="totals-label">Кабинет</span>
        <span class="totals-value sync-summary-value">{{ currentAccountTitle }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Период запроса</span>
        <span class="totals-value sync-summary-value">{{ jobDetails.job.date_from }} - {{ jobDetails.job.date_to }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Всего недель</span>
        <span class="totals-value">{{ totalSteps }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Успешно</span>
        <span class="totals-value">{{ counts.success }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">В работе</span>
        <span class="totals-value">{{ counts.running }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Ожидают</span>
        <span class="totals-value">{{ counts.pending }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Ошибки</span>
        <span class="totals-value">{{ counts.failed }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">429 WB</span>
        <span class="totals-value">{{ rateLimitStats.step429Count }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Последний 429</span>
        <span class="totals-value sync-summary-value">{{ rateLimitStats.last429At ?? '—' }}</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Неделя с лимитом</span>
        <span class="totals-value sync-summary-value">{{ rateLimitStats.last429Week ?? '—' }}</span>
      </div>
    </div>

    <div class="sync-steps-list">
      <article v-for="week in weeklyProgress" :key="`${week.periodFrom}:${week.periodTo}`" class="sync-step-card">
        <div class="sync-step-main">
          <div>
            <strong>{{ week.periodFrom }} - {{ week.periodTo }}</strong>
            <div class="sync-step-meta">
              успешных: {{ week.counts.success }} · в работе: {{ week.counts.running }} · ожидают: {{ week.counts.pending }} · ошибок: {{ week.counts.failed }}
            </div>
          </div>
          <div class="sync-step-tags">
            <span
              v-for="item in week.steps"
              :key="item.step_id"
              class="sync-status-pill sync-status-pill-small"
              :data-status="item.status"
            >
              {{ item.dataset }}
            </span>
          </div>
        </div>
        <div v-if="week.retryMessage" class="sync-step-retry">
          {{ week.retryMessage }}
        </div>
        <div v-if="week.blockReasonMessage" class="sync-step-phase-hint">
          {{ week.blockReasonMessage }}
        </div>
        <div v-if="week.phaseMessage" class="sync-step-phase">
          {{ week.phaseMessage }}
        </div>
        <div v-if="week.phaseDetailMessage" class="sync-step-phase-detail">
          {{ week.phaseDetailMessage }}
        </div>
        <div v-if="week.phaseElapsedMessage" class="sync-step-phase-elapsed">
          {{ week.phaseElapsedMessage }}
        </div>
        <div v-if="week.apiHintMessage" class="sync-step-phase-hint">
          {{ week.apiHintMessage }}
        </div>
        <div v-for="message in week.errorMessages" :key="message" class="sync-step-error">
          {{ message }}
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useSyncJobProgress } from '../composables/useSyncJobProgress'
import type { SyncJobDetailsResponse } from '../types/sync'

const props = defineProps<{
  jobDetails: SyncJobDetailsResponse | null
  currentAccountTitle: string
}>()

const {
  counts,
  totalSteps,
  completedSteps,
  progressPercent,
  weeklyProgress,
  jobStatusLabel,
  rateLimitStats,
} = useSyncJobProgress(toRef(props, 'jobDetails'))
</script>
