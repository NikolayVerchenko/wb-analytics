<template>
  <section class="unit-econ-page">
    <header class="unit-econ-hero">
      <div class="unit-econ-hero-main">
        <h1 class="page-title">Проблемные товары</h1>
        <p class="page-description">
          Показывает, какие SKU приносят прибыль, какие на грани, и какие теряют деньги.
        </p>
        <div class="unit-econ-hero-meta">
          <span v-if="accountId" class="account-badge">Кабинет: {{ accountId }}</span>
          <span v-else class="account-badge account-badge-muted">Кабинет не выбран</span>
        </div>
      </div>
    </header>

    <UiStateBlock
      v-if="!accountId"
      title="Кабинет не выбран"
      description="Выберите кабинет, чтобы увидеть проблемные товары по выбранному периоду."
      variant="empty"
    />

    <template v-else>
      <section class="unit-econ-section">
        <div class="card stack">
          <EconomicsSectionToolbar
            title="Проблемные товары"
            :account-id="accountId"
            :date-from="form.date_from"
            :date-to="form.date_to"
            :filters="selectedFilters"
            @period-apply="handlePeriodApply"
            @filters-apply="handleFiltersApply"
            @filters-reset="handleFiltersReset"
          />

          <template v-if="loading">
            <EconomicsTableSkeleton />
          </template>
          <template v-else-if="error">
            <UiStateBlock
              title="Не удалось загрузить проблемные товары"
              description="Попробуйте обновить страницу или изменить период."
              variant="error"
              action-label="Повторить"
              @action="retryItems"
            />
          </template>
          <template v-else-if="empty">
            <UiStateBlock
              title="Нет данных за выбранный период"
              description="Попробуйте выбрать другие даты или снять фильтры."
              variant="empty"
            />
          </template>
          <template v-else>
            <div class="problems-summary-grid">
              <article
                v-for="card in summaryCards"
                :key="card.key"
                :class="['problems-summary-card', `problems-summary-card-${card.tone}`]"
              >
                <span class="problems-summary-label">{{ card.label }}</span>
                <strong class="problems-summary-value">{{ card.value }}</strong>
              </article>
            </div>

            <div class="problems-quick-filters">
              <button
                v-for="filter in problemQuickFilters"
                :key="filter.value"
                type="button"
                :class="[
                  'problems-filter-chip',
                  { 'problems-filter-chip-active': quickFilter === filter.value },
                ]"
                @click="quickFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>

            <UiStateBlock
              v-if="quickFilterEmpty"
              title="Нет SKU для выбранного среза"
              description="Попробуйте выбрать другой быстрый фильтр."
              variant="empty"
            />
            <ProblemsEconomicsTable v-else :rows="filteredRows" />
          </template>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import EconomicsSectionToolbar from '../components/EconomicsSectionToolbar.vue'
import EconomicsTableSkeleton from '../components/EconomicsTableSkeleton.vue'
import ProblemsEconomicsTable from '../components/ProblemsEconomicsTable.vue'
import UiStateBlock from '../components/UiStateBlock.vue'
import { problemQuickFilters } from '../composables/useProblemsEconomicsDiagnostics'
import { useProblemsEconomicsPage } from '../composables/useProblemsEconomicsPage'

const {
  accountId,
  form,
  selectedFilters,
  loading,
  error,
  empty,
  quickFilterEmpty,
  quickFilter,
  summaryCards,
  filteredRows,
  handleFiltersApply,
  handleFiltersReset,
  handlePeriodApply,
} = useProblemsEconomicsPage()

const retryItems = () =>
  handlePeriodApply({
    date_from: form.value.date_from,
    date_to: form.value.date_to,
  })
</script>

<style scoped>
.problems-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.problems-summary-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
}

.problems-summary-card-profit {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.problems-summary-card-risk {
  border-color: #fde68a;
  background: #fffbeb;
}

.problems-summary-card-loss {
  border-color: #fecaca;
  background: #fef2f2;
}

.problems-summary-label {
  color: #6b7280;
  font-size: 12px;
}

.problems-summary-value {
  color: #111827;
  font-size: 28px;
  line-height: 1.1;
}

.problems-quick-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.problems-filter-chip {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.problems-filter-chip-active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

@media (max-width: 960px) {
  .problems-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .problems-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
