<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Остатки товаров</h2>
        <p class="page-description">
          Страница читает `account_id` из query params и показывает текущий snapshot остатков,
          в пути до клиента и возвратов в пути.
        </p>
      </div>

      <div class="filters">
        <div class="field">
          <label for="stock-account-id">Account ID</label>
          <input id="stock-account-id" :value="accountId || ''" type="text" disabled />
        </div>
      </div>
    </div>

    <div v-if="!accountId" class="message message-empty">
      Выберите кабинет на странице кабинетов, чтобы открыть остатки.
    </div>

    <template v-else>
      <template v-if="loading">
        <div class="message message-info">Загрузка остатков...</div>
      </template>
      <template v-else-if="error">
        <div class="message message-error">{{ error }}</div>
      </template>
      <template v-else-if="empty">
        <div class="message message-empty">Для остатков нет данных по выбранному кабинету.</div>
      </template>
      <template v-else>
        <EconomicsDashboard :metrics="dashboardMetrics">
          <template #header>
            <div class="section-header">
              <h3>Сводка по остаткам</h3>
              <p v-if="lastUpdatedLabel" class="section-meta">Последнее обновление: {{ lastUpdatedLabel }}</p>
            </div>
          </template>
        </EconomicsDashboard>

        <StockTable
          :items="items"
          :totals="totals"
          :expanded-item-keys="expandedItemKeys"
          :warehouses-by-item="warehousesByItem"
          :warehouses-loading-by-item="warehousesLoadingByItem"
          :warehouses-error-by-item="warehousesErrorByItem"
          @toggle-item="toggleItem"
        />
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import EconomicsDashboard from '../components/EconomicsDashboard.vue'
import StockTable from '../components/StockTable.vue'
import { useStocksPage } from '../composables/useStocksPage'
import { useStockWarehouses } from '../composables/useStockWarehouses'

const {
  accountId,
  items,
  totals,
  loading,
  error,
  empty,
  dashboardMetrics,
  lastUpdatedLabel,
} = useStocksPage()

const {
  expandedItemKeys,
  warehousesByItem,
  warehousesLoadingByItem,
  warehousesErrorByItem,
  toggleItem,
} = useStockWarehouses({
  accountId: () => accountId.value,
})
</script>
