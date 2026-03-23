<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Юнит-экономика</h2>
        <p class="page-description">
          Страница читает `account_id`, `table_*` и `dashboard_*` query params и запрашивает
          `/api/economics/period-items` и `/api/economics/dashboard`.
        </p>
      </div>

      <div class="filters">
        <div class="field">
          <label for="account-id">Account ID</label>
          <input id="account-id" :value="accountId || ''" type="text" disabled />
        </div>
      </div>
    </div>

    <div v-if="!accountId" class="message message-empty">
      Выберите кабинет на странице кабинетов, чтобы загрузить данные.
    </div>

    <template v-else>
      <template v-if="dashboardLoading">
        <div class="message message-info">Загрузка дашборда...</div>
      </template>
      <template v-else-if="dashboardError">
        <div class="message message-error">{{ dashboardError }}</div>
      </template>
      <template v-else-if="dashboardEmpty">
        <div class="message message-empty">Для дашборда нет данных за выбранный период.</div>
      </template>
      <template v-else>
        <EconomicsDashboard :metrics="dashboardMetrics">
          <template #header>
            <EconomicsSectionToolbar
              title="Дашборд"
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

      <template v-if="tableLoading">
        <div class="message message-info">Загрузка таблицы...</div>
      </template>
      <template v-else-if="tableError">
        <div class="message message-error">{{ tableError }}</div>
      </template>
      <template v-else-if="tableEmpty">
        <div class="message message-empty">Для таблицы нет данных за выбранный период.</div>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import EconomicsDashboard from '../components/EconomicsDashboard.vue'
import EconomicsSectionToolbar from '../components/EconomicsSectionToolbar.vue'
import EconomicsTable from '../components/EconomicsTable.vue'
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
</script>
