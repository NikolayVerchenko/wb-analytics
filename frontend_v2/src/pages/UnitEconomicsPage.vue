<template>
  <section class="unit-econ-page">
    <header class="unit-econ-hero">
      <div class="unit-econ-hero-main">
        <h1 class="page-title">Полная аналитика</h1>
        <p class="page-description">Подробная экономика по SKU: KPI, полная таблица метрик и детализация по размерам.</p>
        <div class="unit-econ-hero-meta">
          <span v-if="accountId" class="account-badge">Кабинет: {{ accountId }}</span>
          <span v-else class="account-badge account-badge-muted">Кабинет не выбран</span>
        </div>
      </div>

      <div class="unit-econ-hero-actions">
        <div class="unit-econ-hero-actions-title">Управление</div>
        <div class="unit-econ-hero-actions-body">
          <span v-if="accountId" class="account-pill">ID: {{ accountId }}</span>
          <span v-else class="account-pill account-pill-muted">Выберите кабинет</span>
        </div>
      </div>
    </header>

    <UiStateBlock
      v-if="!accountId"
      title="Кабинет не выбран"
      description="Выберите кабинет, чтобы загрузить данные и увидеть аналитику."
      variant="empty"
    />

    <template v-else>
      <TaxSettingsCard
        v-model:tax-rate="taxRatePercent"
        v-model:effective-from="taxEffectiveFrom"
        :loading="taxLoading"
        :saving="taxSaving"
        :error="taxError"
        :message="taxMessage"
        @save-tax-settings="saveTaxSettings"
      />

      <section class="unit-econ-section">
        <template v-if="dashboardLoading">
          <div class="card dashboard-panel">
            <EconomicsSectionToolbar
              title="Полная аналитика"
              :account-id="accountId"
              :date-from="dashboardForm.date_from"
              :date-to="dashboardForm.date_to"
              :filters="dashboardSelectedFilters"
              @period-apply="handleDashboardPeriodApply"
              @filters-apply="handleDashboardFiltersApply"
              @filters-reset="handleDashboardFiltersReset"
            />
            <EconomicsDashboardSkeleton />
          </div>
        </template>
        <template v-else-if="dashboardError">
          <div class="card dashboard-panel">
            <EconomicsSectionToolbar
              title="Полная аналитика"
              :account-id="accountId"
              :date-from="dashboardForm.date_from"
              :date-to="dashboardForm.date_to"
              :filters="dashboardSelectedFilters"
              @period-apply="handleDashboardPeriodApply"
              @filters-apply="handleDashboardFiltersApply"
              @filters-reset="handleDashboardFiltersReset"
            />
            <UiStateBlock
              title="Не удалось загрузить дашборд"
              description="Попробуйте обновить страницу или изменить период."
              variant="error"
              action-label="Повторить"
              @action="retryDashboard"
            />
          </div>
        </template>
        <template v-else-if="dashboardEmpty">
          <div class="card dashboard-panel">
            <EconomicsSectionToolbar
              title="Полная аналитика"
              :account-id="accountId"
              :date-from="dashboardForm.date_from"
              :date-to="dashboardForm.date_to"
              :filters="dashboardSelectedFilters"
              @period-apply="handleDashboardPeriodApply"
              @filters-apply="handleDashboardFiltersApply"
              @filters-reset="handleDashboardFiltersReset"
            />
            <UiStateBlock
              title="Нет данных за выбранный период"
              description="Попробуйте выбрать другие даты или снять фильтры."
              variant="empty"
            />
          </div>
        </template>
        <template v-else>
          <EconomicsDashboard :metrics="dashboardMetrics">
            <template #header>
              <EconomicsSectionToolbar
                title="Полная аналитика"
                :account-id="accountId"
                :date-from="dashboardForm.date_from"
                :date-to="dashboardForm.date_to"
                :filters="dashboardSelectedFilters"
                @period-apply="handleDashboardPeriodApply"
                @filters-apply="handleDashboardFiltersApply"
                @filters-reset="handleDashboardFiltersReset"
              />
            </template>
          </EconomicsDashboard>
        </template>
      </section>

      <div class="section-divider"></div>

      <section class="unit-econ-section">
        <template v-if="tableLoading">
          <div class="card stack">
            <EconomicsSectionToolbar
              title="Товары"
              :account-id="accountId"
              :date-from="form.date_from"
              :date-to="form.date_to"
              :filters="selectedFilters"
              @period-apply="handlePeriodApply"
              @filters-apply="handleFiltersApply"
              @filters-reset="handleFiltersReset"
            />
            <EconomicsTableSkeleton />
          </div>
        </template>
        <template v-else-if="tableError">
          <div class="card stack">
            <EconomicsSectionToolbar
              title="Товары"
              :account-id="accountId"
              :date-from="form.date_from"
              :date-to="form.date_to"
              :filters="selectedFilters"
              @period-apply="handlePeriodApply"
              @filters-apply="handleFiltersApply"
              @filters-reset="handleFiltersReset"
            />
            <UiStateBlock
              title="Не удалось загрузить таблицу"
              description="Попробуйте обновить страницу или изменить параметры фильтра."
              variant="error"
              action-label="Повторить"
              @action="retryTable"
            />
          </div>
        </template>
        <template v-else-if="tableEmpty">
          <div class="card stack">
            <EconomicsSectionToolbar
              title="Товары"
              :account-id="accountId"
              :date-from="form.date_from"
              :date-to="form.date_to"
              :filters="selectedFilters"
              @period-apply="handlePeriodApply"
              @filters-apply="handleFiltersApply"
              @filters-reset="handleFiltersReset"
            />
            <UiStateBlock
              title="Нет данных за выбранный период"
              description="Попробуйте изменить даты или фильтры."
              variant="empty"
            />
          </div>
        </template>
        <template v-else>
          <EconomicsTable
            :items="items"
            :totals="totals"
            :expanded-item-keys="expandedItemKeys"
            :sizes-by-item="sizesByItem"
            :sizes-loading-by-item="sizesLoadingByItem"
            :sizes-error-by-item="sizesErrorByItem"
            @toggle-item="toggleItem"
          >
            <template #header>
              <EconomicsSectionToolbar
                title="Товары"
                :account-id="accountId"
                :date-from="form.date_from"
                :date-to="form.date_to"
                :filters="selectedFilters"
                @period-apply="handlePeriodApply"
                @filters-apply="handleFiltersApply"
                @filters-reset="handleFiltersReset"
              />
            </template>
          </EconomicsTable>
        </template>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import EconomicsDashboard from '../components/EconomicsDashboard.vue'
import EconomicsDashboardSkeleton from '../components/EconomicsDashboardSkeleton.vue'
import EconomicsSectionToolbar from '../components/EconomicsSectionToolbar.vue'
import EconomicsTable from '../components/EconomicsTable.vue'
import EconomicsTableSkeleton from '../components/EconomicsTableSkeleton.vue'
import TaxSettingsCard from '../components/TaxSettingsCard.vue'
import UiStateBlock from '../components/UiStateBlock.vue'
import { useEconomicsPage } from '../composables/useEconomicsPage'
import { useTaxSettings } from '../composables/useTaxSettings'

const {
  accountId,
  form,
  selectedFilters,
  dashboardForm,
  dashboardSelectedFilters,
  items,
  totals,
  dashboardMetrics,
  tableLoading,
  tableError,
  tableEmpty,
  dashboardLoading,
  dashboardError,
  dashboardEmpty,
  expandedItemKeys,
  sizesByItem,
  sizesLoadingByItem,
  sizesErrorByItem,
  toggleItem,
  handleFiltersApply,
  handleFiltersReset,
  handlePeriodApply,
  handleDashboardFiltersApply,
  handleDashboardFiltersReset,
  handleDashboardPeriodApply,
} = useEconomicsPage()

const {
  loading: taxLoading,
  saving: taxSaving,
  error: taxError,
  message: taxMessage,
  taxRatePercent,
  effectiveFrom: taxEffectiveFrom,
  save: saveTaxSettings,
} = useTaxSettings({
  accountId: () => accountId.value,
})

const retryDashboard = () =>
  handleDashboardPeriodApply({
    date_from: dashboardForm.value.date_from,
    date_to: dashboardForm.value.date_to,
  })
const retryTable = () =>
  handlePeriodApply({
    date_from: form.value.date_from,
    date_to: form.value.date_to,
  })
</script>


