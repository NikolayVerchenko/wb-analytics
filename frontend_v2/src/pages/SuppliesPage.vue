<template>
  <section class="stack supplies-page">
    <div class="card stack">
      <div class="section-toolbar">
        <div class="section-toolbar-title">
          <h2 class="page-title">Поставки</h2>
          <p class="page-description">
            Управление списком поставок и себестоимостью товаров. Значения `unit_cogs` из этой страницы участвуют в расчёте экономики.
          </p>
        </div>
        <div v-if="hasAccount" class="section-toolbar-actions">
          <span class="account-pill">Кабинет подключён</span>
          <span class="account-pill account-pill-muted">{{ shortAccountId }}</span>
        </div>
      </div>

      <div v-if="hasAccount" class="filters">
        <div class="field supplies-search-field">
          <label for="supplies-search">Поиск поставки</label>
          <input
            id="supplies-search"
            v-model="searchQuery"
            type="text"
            placeholder="Номер поставки или предзаказа"
          />
        </div>

        <div class="field">
          <label for="supplies-status-filter">Статус</label>
          <select id="supplies-status-filter" v-model="statusFilter" class="field-select">
            <option value="all">Все статусы</option>
            <option value="accepted">Принято</option>
            <option value="partial">Частично принято</option>
            <option value="planned">Запланировано</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="!hasAccount" class="message message-empty">
      Выберите кабинет, чтобы открыть поставки.
    </div>

    <template v-else>
      <div v-if="loading" class="message message-info">Загрузка поставок...</div>
      <div v-else-if="error" class="message message-error">{{ error }}</div>
      <div v-else-if="empty" class="message message-empty">Для выбранного кабинета поставки не найдены.</div>
      <template v-else>
        <div class="totals supplies-summary-grid">
          <article v-for="metric in summaryMetrics" :key="metric.key" class="totals-item">
            <span class="totals-label">{{ metric.label }}</span>
            <strong class="totals-value">{{ metric.value }}</strong>
            <span v-if="metric.hint" class="supplies-summary-hint">{{ metric.hint }}</span>
          </article>
        </div>

        <SuppliesTable
          :supplies="filteredSupplies"
          :expanded-supply-ids="expandedSupplyIds"
          :items-by-supply="itemsBySupply"
          :items-loading-by-supply="itemsLoadingBySupply"
          :items-error-by-supply="itemsErrorBySupply"
          :item-messages="itemMessages"
          :get-item-key="getItemKey"
          :get-draft-value="getDraftValue"
          :is-saving="isSaving"
          :format-date-time="formatDateTime"
          :get-supply-status-meta="getSupplyStatusMeta"
          @toggle-supply="toggleSupply"
          @set-draft-value="setDraftValue"
          @save-item-cost="saveItemCost"
          @save-article-cost-for-all-sizes="saveArticleCostForAllSizes"
        />
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SuppliesTable from '../components/SuppliesTable.vue'
import { useSuppliesPage } from '../composables/useSuppliesPage'

const {
  accountId,
  hasAccount,
  filteredSupplies,
  loading,
  error,
  empty,
  searchQuery,
  statusFilter,
  summaryMetrics,
  expandedSupplyIds,
  itemsBySupply,
  itemsLoadingBySupply,
  itemsErrorBySupply,
  itemMessages,
  getItemKey,
  getDraftValue,
  setDraftValue,
  isSaving,
  toggleSupply,
  saveItemCost,
  saveArticleCostForAllSizes,
  formatDateTime,
  getSupplyStatusMeta,
} = useSuppliesPage()

const shortAccountId = computed(() => {
  if (!accountId.value) {
    return ''
  }
  return accountId.value.length > 18 ? `${accountId.value.slice(0, 18)}…` : accountId.value
})
</script>

<style scoped>
.supplies-page {
  gap: 20px;
}

.supplies-search-field {
  min-width: min(100%, 320px);
}

.supplies-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.supplies-summary-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
</style>
