<template>
  <section v-if="coverage" class="card stack">
    <div class="sync-job-header">
      <div>
        <h3 class="section-title">Доступность данных</h3>
        <p class="sync-helper-text">
          Сначала обзор, затем отдельные вкладки по истории, оперативным данным и справочникам.
        </p>
      </div>
      <span class="sync-status-pill" :data-status="overallStatus">
        {{ formatSectionStatus(overallStatus) }}
      </span>
    </div>

    <div class="sync-coverage-summary-grid">
      <button
        type="button"
        class="sync-coverage-summary-card"
        :class="{ 'sync-coverage-summary-card-active': activeTab === 'historical' }"
        @click="activeTab = 'historical'"
      >
        <span class="sync-coverage-summary-title">История</span>
        <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.historical.status">
          {{ formatSectionStatus(coverage.historical.status) }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.historical.datasets) }}
        </span>
      </button>

      <button
        type="button"
        class="sync-coverage-summary-card"
        :class="{ 'sync-coverage-summary-card-active': activeTab === 'operational' }"
        @click="activeTab = 'operational'"
      >
        <span class="sync-coverage-summary-title">Оперативные</span>
        <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.operational.status">
          {{ formatSectionStatus(coverage.operational.status) }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.operational.datasets) }}
        </span>
      </button>

      <button
        type="button"
        class="sync-coverage-summary-card"
        :class="{ 'sync-coverage-summary-card-active': activeTab === 'reference' }"
        @click="activeTab = 'reference'"
      >
        <span class="sync-coverage-summary-title">Справочники</span>
        <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.reference_data.status">
          {{ formatSectionStatus(coverage.reference_data.status) }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.reference_data.datasets) }}
        </span>
      </button>
    </div>

    <div class="sync-tabs" role="tablist" aria-label="Разделы загрузки данных">
      <button
        type="button"
        class="sync-tab-button"
        :class="{ 'sync-tab-button-active': activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >
        Обзор
      </button>
      <button
        type="button"
        class="sync-tab-button"
        :class="{ 'sync-tab-button-active': activeTab === 'historical' }"
        @click="activeTab = 'historical'"
      >
        История
      </button>
      <button
        type="button"
        class="sync-tab-button"
        :class="{ 'sync-tab-button-active': activeTab === 'operational' }"
        @click="activeTab = 'operational'"
      >
        Оперативные
      </button>
      <button
        type="button"
        class="sync-tab-button"
        :class="{ 'sync-tab-button-active': activeTab === 'reference' }"
        @click="activeTab = 'reference'"
      >
        Справочники
      </button>
    </div>

    <section v-if="activeTab === 'overview'" class="stack">
      <div class="sync-coverage-overview-grid">
        <article class="sync-coverage-overview-card">
          <strong>Исторические данные</strong>
          <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.historical.status">
            {{ formatSectionStatus(coverage.historical.status) }}
          </span>
          <p class="sync-coverage-comment">{{ buildSummaryMeta(coverage.historical.datasets) }}</p>
        </article>
        <article class="sync-coverage-overview-card">
          <strong>Оперативные данные</strong>
          <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.operational.status">
            {{ formatSectionStatus(coverage.operational.status) }}
          </span>
          <p class="sync-coverage-comment">{{ buildSummaryMeta(coverage.operational.datasets) }}</p>
        </article>
        <article class="sync-coverage-overview-card">
          <strong>Карточки, остатки, поставки</strong>
          <span class="sync-status-pill sync-status-pill-small" :data-status="coverage.reference_data.status">
            {{ formatSectionStatus(coverage.reference_data.status) }}
          </span>
          <p class="sync-coverage-comment">{{ buildSummaryMeta(coverage.reference_data.datasets) }}</p>
        </article>
      </div>

      <div class="sync-coverage-attention">
        <h4 class="section-title sync-subtitle">Что требует внимания</h4>
        <div v-if="attentionItems.length" class="stack">
          <div
            v-for="item in attentionItems"
            :key="item.key"
            class="message"
            :class="item.status === 'error' ? 'message-error' : 'message-info'"
          >
            <strong>{{ item.section }}: {{ item.label }}</strong>
            <div>{{ item.message }}</div>
          </div>
        </div>
        <div v-else class="message message-info">
          Существенных проблем не видно. Данные по всем контурам выглядят актуальными.
        </div>
      </div>
    </section>

    <section v-else class="stack">
      <div class="sync-job-header">
        <div>
          <h4 class="section-title sync-subtitle">{{ currentSectionTitle }}</h4>
          <p class="sync-helper-text">{{ currentSectionDescription }}</p>
        </div>
        <span class="sync-status-pill" :data-status="currentSection.status">
          {{ formatSectionStatus(currentSection.status) }}
        </span>
      </div>

      <div class="sync-coverage-table-wrapper">
        <table class="sync-coverage-table">
          <thead>
            <tr>
              <th>Набор данных</th>
              <th>Статус</th>
              <th>С</th>
              <th>По / актуально</th>
              <th>Последняя загрузка</th>
              <th>Объём</th>
              <th>Пробелы</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dataset in currentSection.datasets" :key="`${activeTab}:${dataset.dataset}`">
              <td><strong>{{ dataset.label }}</strong></td>
              <td>
                <span class="sync-status-pill sync-status-pill-small" :data-status="dataset.status">
                  {{ formatSectionStatus(dataset.status) }}
                </span>
              </td>
              <td>{{ dataset.loaded_from ?? '—' }}</td>
              <td>{{ dataset.loaded_to ?? formatDateTime(dataset.actual_at) }}</td>
              <td>{{ formatDateTime(dataset.last_success_at) }}</td>
              <td>{{ dataset.entity_count ?? '—' }}</td>
              <td>
                <template v-if="dataset.missing_periods.length">
                  <details class="sync-inline-details">
                    <summary>{{ dataset.missing_periods.length }} пропусков</summary>
                    <div class="sync-inline-details-content">
                      <span
                        v-for="period in dataset.missing_periods"
                        :key="`${dataset.dataset}:${period.date_from}:${period.date_to}`"
                        class="sync-dataset-chip sync-dataset-chip-failed"
                      >
                        {{ formatPeriod(period.date_from, period.date_to) }}
                      </span>
                    </div>
                  </details>
                </template>
                <template v-else>—</template>
              </td>
              <td>{{ dataset.comment ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  SyncCoverageDataset,
  SyncCoverageResponse,
  SyncCoverageSection,
  SyncCoverageSectionStatus,
} from '../types/sync'

const props = defineProps<{
  coverage: SyncCoverageResponse | null
}>()

type CoverageTab = 'overview' | 'historical' | 'operational' | 'reference'

const activeTab = ref<CoverageTab>('overview')

const overallStatus = computed<SyncCoverageSectionStatus>(() => {
  const statuses = [
    props.coverage?.historical.status,
    props.coverage?.operational.status,
    props.coverage?.reference_data.status,
  ].filter(Boolean) as SyncCoverageSectionStatus[]

  if (statuses.includes('loading')) return 'loading'
  if (statuses.includes('partial')) return 'partial'
  if (statuses.includes('error')) return 'error'
  if (statuses.length > 0 && statuses.every((status) => status === 'empty')) return 'empty'
  if (statuses.includes('stale')) return 'stale'
  return 'actual'
})

const currentSection = computed<SyncCoverageSection>(() => {
  if (!props.coverage) {
    return { status: 'empty', datasets: [] }
  }
  if (activeTab.value === 'historical') {
    return props.coverage.historical
  }
  if (activeTab.value === 'operational') {
    return props.coverage.operational
  }
  return props.coverage.reference_data
})

const currentSectionTitle = computed(() => {
  if (activeTab.value === 'historical') return 'Исторические данные'
  if (activeTab.value === 'operational') return 'Оперативные данные'
  return 'Карточки, остатки и поставки'
})

const currentSectionDescription = computed(() => {
  if (activeTab.value === 'historical') {
    return 'Закрытые периоды, на которые опираются аналитика и экономика.'
  }
  if (activeTab.value === 'operational') {
    return 'Незакрытая неделя и быстрые данные для ежедневного контроля.'
  }
  return 'Справочные и snapshot-данные для интерфейса и расчётов.'
})

const attentionItems = computed(() => {
  if (!props.coverage) {
    return []
  }

  const sections: Array<{ section: string; datasets: SyncCoverageDataset[] }> = [
    { section: 'История', datasets: props.coverage.historical.datasets },
    { section: 'Оперативные', datasets: props.coverage.operational.datasets },
    { section: 'Справочники', datasets: props.coverage.reference_data.datasets },
  ]

  return sections.flatMap((section) =>
    section.datasets
      .filter((dataset) => dataset.status !== 'actual' && dataset.status !== 'empty')
      .map((dataset) => ({
        key: `${section.section}:${dataset.dataset}`,
        section: section.section,
        label: dataset.label,
        status: dataset.status,
        message:
          dataset.comment ??
          (dataset.status === 'partial'
            ? 'Есть пробелы или частичные ошибки.'
            : dataset.status === 'stale'
              ? 'Данные устарели и требуют обновления.'
              : dataset.status === 'loading'
                ? 'Сейчас идёт обновление.'
                : 'Есть проблема с последней загрузкой.'),
      })),
  )
})

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

function buildSummaryMeta(datasets: SyncCoverageDataset[]): string {
  const actual = datasets.filter((dataset) => dataset.status === 'actual').length
  const nonActual = datasets.filter((dataset) => dataset.status !== 'actual' && dataset.status !== 'empty').length
  const latestDate = datasets
    .map((dataset) => dataset.loaded_to ?? dataset.actual_at ?? dataset.last_success_at)
    .filter(Boolean)
    .sort()
  const lastIndex = latestDate.length - 1
  const latest = lastIndex >= 0 ? latestDate[lastIndex] : null

  if (nonActual === 0 && latest) {
    return `Актуально по ${latest}`
  }
  if (nonActual === 0) {
    return `${actual} наб. данных выглядят актуальными`
  }
  return `${nonActual} требуют внимания`
}
</script>
