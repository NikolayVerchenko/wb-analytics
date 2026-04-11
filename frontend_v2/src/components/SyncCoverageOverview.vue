<template>
  <section v-if="coverage" class="card stack">
    <div class="sync-job-header">
      <div>
        <h3 class="section-title">Доступность данных</h3>
        <p class="sync-helper-text">
          Выберите нужный раздел: история, оперативные данные или справочники.
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
        <span class="sync-status-pill sync-status-pill-small" :data-status="historicalUiStatus">
          {{ formatSectionStatus(historicalUiStatus, 'historical') }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.historical.datasets, 'historical') }}
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
          {{ formatSectionStatus(coverage.operational.status, 'operational') }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.operational.datasets, 'operational') }}
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
          {{ formatSectionStatus(coverage.reference_data.status, 'reference') }}
        </span>
        <span class="sync-coverage-summary-meta">
          {{ buildSummaryMeta(coverage.reference_data.datasets, 'reference') }}
        </span>
      </button>
    </div>

    <section class="stack">
      <div class="sync-job-header">
        <div>
          <h4 class="section-title sync-subtitle">{{ currentSectionTitle }}</h4>
          <p class="sync-helper-text">{{ currentSectionDescription }}</p>
        </div>
        <div class="sync-section-actions">
          <button
            type="button"
            class="primary-button"
            :disabled="props.primaryActionDisabled"
            @click="emit('primary-action')"
          >
            {{ props.createLoading ? props.primaryActionLoadingLabel : props.primaryActionLabel }}
          </button>
          <span class="sync-status-pill" :data-status="currentSectionUiStatus">
            {{ formatSectionStatus(currentSectionUiStatus, activeTab) }}
          </span>
        </div>
      </div>

      <div v-if="activeTab === 'historical'" class="message message-info">
        <strong>{{ historicalReady ? 'История загружена полностью.' : 'История загружена не полностью.' }}</strong>
        <div><strong>Период в базе:</strong> {{ historicalCoveragePeriod }}</div>
        <div>{{ historicalSummaryText }}</div>
      </div>

      <div class="sync-coverage-table-wrapper">
        <table class="sync-coverage-table">
          <thead>
            <tr v-if="activeTab === 'historical'">
              <th>Набор данных</th>
              <th>Состояние</th>
              <th>Последняя загрузка</th>
              <th>Что сделать</th>
            </tr>
            <tr v-else>
              <th>Набор данных</th>
              <th>Статус</th>
              <th>С</th>
              <th>По / актуально</th>
              <th>Последняя загрузка</th>
              <th>Объём</th>
              <th>Пробелы</th>
              <th>Действие</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dataset in currentSection.datasets" :key="`${activeTab}:${dataset.dataset}`">
              <td><strong>{{ dataset.label }}</strong></td>
              <template v-if="activeTab === 'historical'">
                <td>
                  <span
                    class="sync-status-pill sync-status-pill-small"
                    :data-status="isHistoricalDatasetReady(dataset) ? 'actual' : 'partial'"
                  >
                    {{ isHistoricalDatasetReady(dataset) ? 'Все загружено' : 'Не все загружено' }}
                  </span>
                </td>
                <td>{{ formatDateTime(dataset.last_success_at) }}</td>
                <td>
                  <button
                    v-if="showDatasetGapFillAction(dataset)"
                    type="button"
                    class="secondary-button secondary-button-compact"
                    :disabled="props.createLoading"
                    @click="emit('history-gap-fill', dataset.dataset)"
                  >
                    {{ props.createLoading ? 'Запускаю...' : 'Догрузить' }}
                  </button>
                  <template v-else>—</template>
                </td>
              </template>
              <template v-else>
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
                    <summary>Показать периоды ({{ dataset.missing_periods.length }})</summary>
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
              <td>
                <button
                  v-if="showDatasetGapFillAction(dataset)"
                  type="button"
                  class="secondary-button secondary-button-compact"
                  :disabled="props.createLoading"
                  @click="emit('history-gap-fill', dataset.dataset)"
                >
                  {{ props.createLoading ? 'Запускаю...' : 'Догрузить' }}
                </button>
                <template v-else>—</template>
              </td>
              <td>{{ dataset.comment ?? '—' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <details v-if="activeTab === 'historical' && historicalPendingDatasets.length" class="sync-history-details">
        <summary>Показать, чего именно не хватает</summary>
        <div class="sync-history-details-body">
          <article
            v-for="dataset in historicalPendingDatasets"
            :key="`historical-detail:${dataset.dataset}`"
            class="sync-history-detail-card"
          >
            <strong>{{ dataset.label }}</strong>
            <div
              v-for="item in buildHistoricalDetails(dataset)"
              :key="`${dataset.dataset}:${item}`"
              class="sync-coverage-comment"
            >
              {{ item }}
            </div>
            <div v-if="dataset.missing_periods.length" class="sync-inline-periods">
              <span
                v-for="period in dataset.missing_periods"
                :key="`${dataset.dataset}:${period.date_from}:${period.date_to}`"
                class="sync-dataset-chip sync-dataset-chip-failed"
              >
                {{ formatPeriod(period.date_from, period.date_to) }}
              </span>
            </div>
          </article>
        </div>
      </details>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  SyncCoverageDataset,
  SyncCoverageResponse,
  SyncCoverageSection,
  SyncCoverageSectionStatus,
} from '../types/sync'

export type CoverageTab = 'historical' | 'operational' | 'reference'

const props = defineProps<{
  coverage: SyncCoverageResponse | null
  activeTab?: CoverageTab
  createLoading?: boolean
  primaryActionLabel?: string
  primaryActionLoadingLabel?: string
  primaryActionDisabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', value: CoverageTab): void
  (e: 'primary-action'): void
  (e: 'history-gap-fill', dataset: string): void
}>()

const activeTab = computed<CoverageTab>({
  get: () => props.activeTab ?? 'historical',
  set: (value) => emit('update:activeTab', value),
})

const overallStatus = computed<SyncCoverageSectionStatus>(() => {
  const statuses = [
    historicalUiStatus.value,
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
    return {
      ...props.coverage.historical,
      datasets: getHistoricalDisplayDatasets(props.coverage.historical.datasets),
    }
  }
  if (activeTab.value === 'operational') {
    return props.coverage.operational
  }
  return props.coverage.reference_data
})

const historicalAnchorDataset = computed(() =>
  getHistoricalDisplayDatasets(props.coverage?.historical.datasets ?? []).find((dataset) => dataset.dataset === 'sales') ?? null,
)

const historicalPendingDatasets = computed(() =>
  getHistoricalDisplayDatasets(props.coverage?.historical.datasets ?? []).filter((dataset) => !isHistoricalDatasetReady(dataset)),
)

const historicalReady = computed(() => historicalPendingDatasets.value.length === 0)

const historicalUiStatus = computed<SyncCoverageSectionStatus>(() => {
  if (!historicalAnchorDataset.value?.loaded_from || !historicalAnchorDataset.value?.loaded_to) {
    return 'empty'
  }
  return historicalReady.value ? 'actual' : 'partial'
})

const currentSectionUiStatus = computed<SyncCoverageSectionStatus>(() => {
  if (activeTab.value === 'historical') {
    return historicalUiStatus.value
  }
  return currentSection.value.status
})

const historicalCoveragePeriod = computed(() => {
  const anchor = historicalAnchorDataset.value
  if (!anchor?.loaded_from || !anchor.loaded_to) {
    return 'ещё не определён'
  }
  return `${anchor.loaded_from} — ${anchor.loaded_to}`
})

const historicalSummaryText = computed(() => {
  if (historicalReady.value) {
    return 'Продажи и зависимые исторические данные доведены до одного покрытия.'
  }
  return `Не хватает: ${historicalPendingDatasets.value.map((dataset) => dataset.label).join(', ')}.`
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

function formatSectionStatus(
  status: SyncCoverageSectionStatus,
  section: CoverageTab | 'historical' | 'operational' | 'reference' = 'historical',
): string {
  if (section === 'historical') {
    return status === 'actual' ? 'Все загружено' : 'Не все загружено'
  }
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

function showDatasetGapFillAction(dataset: SyncCoverageDataset): boolean {
  return activeTab.value === 'historical' && isGapFillEligible(dataset) && !isHistoricalDatasetReady(dataset)
}

function buildSummaryMeta(datasets: SyncCoverageDataset[], section: CoverageTab | 'historical' | 'operational' | 'reference' = 'historical'): string {
  if (section === 'historical') {
    const notReady = getHistoricalDisplayDatasets(datasets).filter((dataset) => !isHistoricalDatasetReady(dataset))
    const period = historicalCoveragePeriod.value
    if (notReady.length === 0) {
      return `В базе: ${period}. Все исторические данные доведены до продаж.`
    }
    return `В базе: ${period}. Не хватает: ${notReady.map((dataset) => dataset.label).join(', ')}`
  }
  const actual = datasets.filter((dataset) => dataset.status === 'actual').length
  const nonActual = datasets.filter((dataset) => dataset.status !== 'actual' && dataset.status !== 'empty').length
  const latestDate = datasets
    .map((dataset) => dataset.loaded_to ?? dataset.actual_at ?? dataset.last_success_at)
    .filter(Boolean)
    .sort()
  const lastIndex = latestDate.length - 1
  const latest = lastIndex >= 0 ? latestDate[lastIndex] : null

  if (nonActual === 0 && latest) {
    return section === 'operational'
      ? `Актуально на ${formatDateTime(latest)}`
      : `Обновлено ${formatDateTime(latest)}`
  }
  if (nonActual === 0) {
    return section === 'operational'
      ? 'Оперативные данные выглядят актуальными'
      : 'Справочники выглядят актуальными'
  }
  return section === 'operational'
    ? `Требуют внимания: ${datasets.filter((dataset) => dataset.status !== 'actual' && dataset.status !== 'empty').map((dataset) => dataset.label).join(', ')}`
    : `Не хватает: ${datasets.filter((dataset) => dataset.status !== 'actual' && dataset.status !== 'empty').map((dataset) => dataset.label).join(', ')}`
}

function isGapFillEligible(dataset: SyncCoverageDataset): boolean {
  return ['adverts_cost', 'acceptance', 'storage'].includes(dataset.dataset)
}

function getHistoricalDisplayDatasets(datasets: SyncCoverageDataset[]): SyncCoverageDataset[] {
  return datasets.filter((dataset) => dataset.dataset !== 'adverts_snapshot')
}

function isHistoricalDatasetReady(dataset: SyncCoverageDataset): boolean {
  if (dataset.dataset === 'sales') {
    return dataset.status === 'actual'
  }

  const anchor = historicalAnchorDataset.value
  if (!anchor?.loaded_from || !anchor.loaded_to || !dataset.loaded_from || !dataset.loaded_to) {
    return false
  }

  return dataset.loaded_from <= anchor.loaded_from && dataset.loaded_to >= anchor.loaded_to && dataset.missing_periods.length === 0
}

function buildHistoricalDetails(dataset: SyncCoverageDataset): string[] {
  const details: string[] = []

  if (dataset.loaded_from || dataset.loaded_to) {
    details.push(`Покрытие: ${dataset.loaded_from ?? '—'} — ${dataset.loaded_to ?? '—'}.`)
  }

  if (dataset.dataset === 'sales') {
    details.push('Продажи используются как опорный набор для проверки полноты истории.')
  }

  if (!isHistoricalDatasetReady(dataset) && dataset.dataset !== 'sales') {
    details.push('Этот набор ещё не доведён до покрытия продаж.')
  }

  if (dataset.comment) {
    details.push(dataset.comment)
  }

  return details
}
</script>
