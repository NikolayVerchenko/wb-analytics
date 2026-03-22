<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Юнит-экономика</h2>
        <p class="page-description">
          Страница читает `account_id`, `date_from` и `date_to` из query params и запрашивает
          `/api/economics/period-items`.
        </p>
      </div>

      <div class="filters">
        <div class="field">
          <label for="account-id">Account ID</label>
          <input id="account-id" :value="accountId || ''" type="text" disabled />
        </div>

        <PeriodFilter
          :date-from="form.date_from"
          :date-to="form.date_to"
          @apply="handlePeriodApply"
        />

        <EconomicsFilters
          :account-id="accountId"
          :date-from="form.date_from"
          :date-to="form.date_to"
          :value="selectedFilters"
          @apply="handleFiltersApply"
          @reset="handleFiltersReset"
        />
      </div>
    </div>

    <div v-if="!accountId" class="message message-empty">
      Выберите кабинет на странице кабинетов, чтобы загрузить данные.
    </div>

    <template v-else>
      <div v-if="loading" class="message message-info">Загрузка данных...</div>
      <div v-else-if="error" class="message message-error">{{ error }}</div>
      <div v-else-if="items.length === 0" class="message message-empty">Нет данных за выбранный период.</div>
      <EconomicsTable
        v-else
        :items="items"
        :totals="totals"
        :expanded-item-keys="expandedItemKeys"
        :sizes-by-item="sizesByItem"
        :sizes-loading-by-item="sizesLoadingByItem"
        :sizes-error-by-item="sizesErrorByItem"
        @toggle-item="toggleItem"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import EconomicsFilters from '../components/EconomicsFilters.vue'
import EconomicsTable from '../components/EconomicsTable.vue'
import PeriodFilter from '../components/PeriodFilter.vue'
import { useEconomicsPage } from '../composables/useEconomicsPage'

const {
  accountId,
  form,
  selectedFilters,
  items,
  totals,
  loading,
  error,
  expandedItemKeys,
  sizesByItem,
  sizesLoadingByItem,
  sizesErrorByItem,
  toggleItem,
  handleFiltersApply,
  handleFiltersReset,
  handlePeriodApply,
} = useEconomicsPage()
</script>
