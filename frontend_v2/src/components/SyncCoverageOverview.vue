<template>
  <section v-if="coverage" class="stack">
    <article class="card stack">
      <div class="sync-job-header">
        <div>
          <h3 class="section-title">Исторические данные</h3>
          <p class="sync-helper-text">
            Закрытые периоды, на которые опираются аналитика и экономика.
          </p>
        </div>
        <span class="sync-status-pill" :data-status="coverage.historical.status">
          {{ formatSectionStatus(coverage.historical.status) }}
        </span>
      </div>
      <div class="sync-coverage-grid">
        <article
          v-for="dataset in coverage.historical.datasets"
          :key="`historical:${dataset.dataset}`"
          class="sync-coverage-card"
        >
          <div class="sync-dataset-header">
            <strong>{{ dataset.label }}</strong>
            <span class="sync-status-pill sync-status-pill-small" :data-status="dataset.status">
              {{ formatSectionStatus(dataset.status) }}
            </span>
          </div>
          <div class="sync-coverage-meta">
            <div class="totals-item">
              <span class="totals-label">Загружено с</span>
              <span class="totals-value sync-summary-value">{{ dataset.loaded_from ?? '—' }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Загружено по</span>
              <span class="totals-value sync-summary-value">{{ dataset.loaded_to ?? '—' }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Последняя успешная загрузка</span>
              <span class="totals-value sync-summary-value">{{ formatDateTime(dataset.last_success_at) }}</span>
            </div>
          </div>
          <div v-if="dataset.missing_periods.length" class="sync-dataset-block">
            <span class="sync-dataset-label">Пробелы в периодах</span>
            <div class="sync-dataset-periods">
              <span
                v-for="period in dataset.missing_periods"
                :key="`${dataset.dataset}:${period.date_from}:${period.date_to}`"
                class="sync-dataset-chip sync-dataset-chip-failed"
              >
                {{ formatPeriod(period.date_from, period.date_to) }}
              </span>
            </div>
          </div>
          <p v-if="dataset.comment" class="sync-coverage-comment">{{ dataset.comment }}</p>
        </article>
      </div>
    </article>

    <article class="card stack">
      <div class="sync-job-header">
        <div>
          <h3 class="section-title">Оперативные данные</h3>
          <p class="sync-helper-text">
            Текущая неделя и быстрые обновления, которые ещё могут меняться.
          </p>
        </div>
        <span class="sync-status-pill" :data-status="coverage.operational.status">
          {{ formatSectionStatus(coverage.operational.status) }}
        </span>
      </div>
      <div class="sync-coverage-grid">
        <article
          v-for="dataset in coverage.operational.datasets"
          :key="`operational:${dataset.dataset}`"
          class="sync-coverage-card"
        >
          <div class="sync-dataset-header">
            <strong>{{ dataset.label }}</strong>
            <span class="sync-status-pill sync-status-pill-small" :data-status="dataset.status">
              {{ formatSectionStatus(dataset.status) }}
            </span>
          </div>
          <div class="sync-coverage-meta">
            <div class="totals-item">
              <span class="totals-label">Актуально по</span>
              <span class="totals-value sync-summary-value">{{ dataset.loaded_to ?? '—' }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Последнее обновление</span>
              <span class="totals-value sync-summary-value">{{ formatDateTime(dataset.last_success_at ?? dataset.actual_at) }}</span>
            </div>
          </div>
          <p v-if="dataset.comment" class="sync-coverage-comment">{{ dataset.comment }}</p>
        </article>
      </div>
    </article>

    <article class="card stack">
      <div class="sync-job-header">
        <div>
          <h3 class="section-title">Карточки, остатки и поставки</h3>
          <p class="sync-helper-text">
            Справочные и snapshot-данные для интерфейса и расчётов.
          </p>
        </div>
        <span class="sync-status-pill" :data-status="coverage.reference_data.status">
          {{ formatSectionStatus(coverage.reference_data.status) }}
        </span>
      </div>
      <div class="sync-coverage-grid">
        <article
          v-for="dataset in coverage.reference_data.datasets"
          :key="`reference:${dataset.dataset}`"
          class="sync-coverage-card"
        >
          <div class="sync-dataset-header">
            <strong>{{ dataset.label }}</strong>
            <span class="sync-status-pill sync-status-pill-small" :data-status="dataset.status">
              {{ formatSectionStatus(dataset.status) }}
            </span>
          </div>
          <div class="sync-coverage-meta">
            <div class="totals-item">
              <span class="totals-label">Последнее обновление</span>
              <span class="totals-value sync-summary-value">{{ formatDateTime(dataset.last_success_at ?? dataset.actual_at) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Объём</span>
              <span class="totals-value">{{ dataset.entity_count ?? '—' }}</span>
            </div>
          </div>
          <p v-if="dataset.comment" class="sync-coverage-comment">{{ dataset.comment }}</p>
        </article>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { SyncCoverageResponse, SyncCoverageSectionStatus } from '../types/sync'

defineProps<{
  coverage: SyncCoverageResponse | null
}>()

function formatSectionStatus(status: SyncCoverageSectionStatus): string {
  const labels: Record<SyncCoverageSectionStatus, string> = {
    actual: 'Актуально',
    partial: 'Частично',
    stale: 'Устарело',
    loading: 'Обновляется',
    error: 'Ошибка',
    empty: 'Нет данных',
  }
  return labels[status]
}

function formatPeriod(periodFrom: string, periodTo: string): string {
  return periodFrom === periodTo ? periodFrom : `${periodFrom} - ${periodTo}`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ru-RU')
}
</script>
