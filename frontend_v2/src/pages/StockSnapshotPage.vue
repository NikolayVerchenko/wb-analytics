<template>
  <section class="grid gap-6">
    <header class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div class="grid gap-2">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Остатки товаров</h1>
        <p class="text-sm text-zinc-600">
          Снимок текущих остатков, товаров в пути до клиента и возвратов в пути.
        </p>
      </div>
      <div class="mt-4">
        <span
          v-if="accountId"
          class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
        >
          Кабинет: {{ accountId }}
        </span>
        <span
          v-else
          class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600"
        >
          Кабинет не выбран
        </span>
      </div>
    </header>

    <UiStateBlock
      v-if="!accountId"
      title="Кабинет не выбран"
      description="Выберите кабинет в верхнем меню, чтобы открыть страницу остатков."
      variant="empty"
    />

    <template v-else>
      <template v-if="loading">
        <UiStateBlock title="Загрузка остатков" description="Подготавливаем данные склада..." variant="info" />
      </template>
      <template v-else-if="error">
        <UiStateBlock title="Ошибка загрузки" :description="error" variant="error" />
      </template>
      <template v-else-if="empty">
        <UiStateBlock
          title="Нет данных за выбранный период"
          description="Для выбранного кабинета пока нет данных по остаткам."
          variant="empty"
        />
      </template>
      <template v-else>
        <EconomicsDashboard :metrics="dashboardMetrics">
          <template #header>
            <div class="grid gap-1">
              <h3 class="text-lg font-semibold text-zinc-900">Сводка по остаткам</h3>
              <p v-if="lastUpdatedLabel" class="text-sm text-zinc-500">Последнее обновление: {{ lastUpdatedLabel }}</p>
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
import UiStateBlock from '../components/UiStateBlock.vue'
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
