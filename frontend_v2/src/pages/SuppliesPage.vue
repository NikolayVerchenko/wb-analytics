<template>
  <section class="grid gap-6 supplies-page">
    <div class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div class="grid gap-4">
        <div class="grid gap-2">
          <h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Поставки</h1>
          <p class="text-sm text-zinc-600">
            Управление списком поставок и себестоимостью товаров. Значения `unit_cogs` из этой страницы участвуют в расчёте экономики.
          </p>
        </div>
        <div v-if="hasAccount" class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Кабинет подключён</span>
          <span class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">{{ shortAccountId }}</span>
        </div>
      </div>

      <div v-if="hasAccount" class="mt-6 grid gap-4 md:grid-cols-2">
        <div class="grid gap-1.5 supplies-search-field">
          <label for="supplies-search" class="text-sm font-medium text-zinc-700">Поиск поставки</label>
          <input
            id="supplies-search"
            v-model="searchQuery"
            type="text"
            placeholder="Номер поставки или предзаказа"
            class="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
          />
        </div>

        <div class="grid gap-1.5">
          <label for="supplies-status-filter" class="text-sm font-medium text-zinc-700">Статус</label>
          <select id="supplies-status-filter" v-model="statusFilter" class="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900">
            <option value="all">Все статусы</option>
            <option value="accepted">Принято</option>
            <option value="partial">Частично принято</option>
            <option value="planned">Запланировано</option>
          </select>
        </div>
      </div>
    </div>

    <UiStateBlock
      v-if="!hasAccount"
      title="Кабинет не выбран"
      description="Выберите кабинет в верхнем меню, чтобы открыть поставки."
      variant="empty"
    />

    <template v-else>
      <UiStateBlock v-if="loading" title="Загрузка поставок" description="Подготавливаем список поставок..." variant="info" />
      <UiStateBlock v-else-if="error" title="Ошибка загрузки" :description="error" variant="error" />
      <UiStateBlock
        v-else-if="empty"
        title="Данные не найдены"
        description="Для выбранного кабинета поставки не найдены."
        variant="empty"
      />
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
import UiStateBlock from '../components/UiStateBlock.vue'
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
