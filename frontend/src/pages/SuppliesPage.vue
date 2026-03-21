<template>
  <main class="flex flex-col gap-6">
    <section class="rounded-[26px] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-clay">Себестоимость через поставки</p>
          <h2 class="mt-2.5 text-[30px] font-semibold tracking-tight text-ink">Поставки</h2>
          <p class="mt-2.5 max-w-3xl text-[14px] leading-6 text-ink/70">
        Теперь в строке товара поставки можно ввести себестоимость. Это и есть первый шаг к тому,
        чтобы потом тащить себестоимость в экономику через поставку.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
          <div class="rounded-[20px] border border-sand/70 bg-paper/70 px-4 py-3.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/42">Источник</p>
            <p class="mt-2 text-[15px] font-semibold text-ink">Партии и размеры</p>
          </div>
          <div class="rounded-[20px] border border-sand/70 bg-paper/70 px-4 py-3.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/42">Результат</p>
            <p class="mt-2 text-[15px] font-semibold text-ink">COGS для экономики</p>
          </div>
        </div>
      </div>
    </section>

    <SuppliesTable
      :items="items"
      :supply-items="supplyItems"
      :expanded-ids="expandedIds"
      :loading-item-ids="loadingItemIds"
      :item-errors="itemErrors"
      :get-item-row-key="getItemRowKey"
      :get-cost-state="getCostState"
      :selected-account-name="selectedAccountName"
      :is-loading="isLoading"
      :error-message="errorMessage"
      @toggle-items="toggleItems"
      @update-cost-draft="updateCostDraft"
      @save-cost="saveCost"
      @save-article-cost="saveArticleCost"
    />
  </main>
</template>

<script setup lang="ts">
import SuppliesTable from '../features/supplies-table/ui/SuppliesTable.vue'
import { useSupplies } from '../entities/supplies/model/useSupplies'

const {
  items,
  supplyItems,
  itemErrors,
  expandedIds,
  loadingItemIds,
  isLoading,
  errorMessage,
  selectedAccountName,
  getItemRowKey,
  getCostState,
  toggleItems,
  updateCostDraft,
  saveCost,
  saveArticleCost,
} = useSupplies()
</script>
