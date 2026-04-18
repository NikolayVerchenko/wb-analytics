<template>
  <section class="grid gap-6">
    <UiStateBlock
      v-if="!accountId"
      title="Кабинет не выбран"
      description="Выберите кабинет, чтобы загрузить данные и увидеть аналитику."
      variant="empty"
    />

    <template v-else>
      <section class="unit-econ-section">
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
          <EconomicsDashboardSkeleton v-if="dashboardLoading" />
          <UiStateBlock
            v-else-if="dashboardError"
            title="Не удалось загрузить дашборд"
            description="Попробуйте обновить страницу или изменить период."
            variant="error"
            action-label="Повторить"
            @action="retryDashboard"
          />
          <UiStateBlock
            v-else-if="dashboardEmpty"
            title="Нет данных за выбранный период"
            description="Попробуйте выбрать другие даты или снять фильтры."
            variant="empty"
          />
          <EconomicsDashboard v-else embedded :metrics="dashboardMetrics" />
        </div>
      </section>

      <div class="section-divider"></div>

      <section class="unit-econ-section">
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
          <EconomicsTableSkeleton v-if="tableLoading" />
          <UiStateBlock
            v-else-if="tableError"
            title="Не удалось загрузить таблицу"
            description="Попробуйте обновить страницу или изменить параметры фильтра."
            variant="error"
            action-label="Повторить"
            @action="retryTable"
          />
          <UiStateBlock
            v-else-if="tableEmpty"
            title="Нет данных за выбранный период"
            description="Попробуйте изменить даты или фильтры."
            variant="empty"
          />
          <EconomicsTable
            v-else
            embedded
            :items="items"
            :totals="totals"
            :expanded-item-keys="expandedItemKeys"
            :sizes-by-item="sizesByItem"
            :sizes-loading-by-item="sizesLoadingByItem"
            :sizes-error-by-item="sizesErrorByItem"
            @toggle-item="toggleItem"
          />
        </div>
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
import UiStateBlock from '../components/UiStateBlock.vue'
import { useEconomicsPage } from '../composables/useEconomicsPage'

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


