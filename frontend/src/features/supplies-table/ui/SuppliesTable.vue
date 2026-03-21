<template>
  <section class="rounded-[28px] border border-sand/90 bg-white/80 p-6 shadow-panel backdrop-blur">
    <div class="flex flex-col gap-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-clay">Endpoint supplies</p>
        <h3 class="mt-2 text-2xl font-semibold tracking-tight text-ink">Поставки аккаунта</h3>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
          Теперь в товарах поставки можно задавать себестоимость либо на конкретный размер, либо сразу на все размеры артикула в этой поставке.
        </p>
      </div>

      <div v-if="!selectedAccountName" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Сначала нужно выбрать аккаунт в верхней панели layout.
      </div>

      <div v-else class="rounded-2xl bg-paper px-4 py-3 text-sm text-ink/70">
        Активный кабинет: <strong class="text-ink">{{ selectedAccountName }}</strong>
      </div>

      <div v-if="errorMessage" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Ошибка загрузки: {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="rounded-2xl bg-paper px-4 py-6 text-sm text-ink/70">
        Загружаю поставки...
      </div>

      <div v-else-if="items.length === 0" class="rounded-2xl bg-paper px-4 py-6 text-sm text-ink/70">
        Для выбранного кабинета поставок нет.
      </div>

      <div v-else class="overflow-hidden rounded-[24px] border border-sand">
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-[13px]">
            <thead class="bg-paper text-left text-[11px] uppercase tracking-[0.18em] text-ink/50">
              <tr>
                <th class="px-3 py-2"></th>
                <th v-for="column in listColumns" :key="column.key" class="px-3 py-2">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <template v-for="item in items" :key="item.supply_id">
                <tr class="border-t border-sand/70">
                  <td class="px-3 py-3">
                    <TableExpandButton
                      :expanded="isExpanded(item.supply_id)"
                      :is-loading="isRowLoading(item.supply_id)"
                      size="sm"
                      @click="emit('toggleItems', item)"
                    />
                  </td>
                  <td
                    v-for="column in listColumns"
                    :key="column.key"
                    class="px-3 py-3"
                    :class="column.key === 'supply_id' ? 'font-semibold text-ink' : 'text-ink/70'"
                  >
                    {{ formatSupplyListCell(item, column.key) }}
                  </td>
                </tr>

                <template v-if="isExpanded(item.supply_id)">
                  <TableMessageRow
                    v-if="isRowLoading(item.supply_id)"
                    :colspan="detailColspan"
                    message="Загружаю товары поставки..."
                    cell-class="px-3 py-3"
                    message-class="px-3 py-3 text-sm text-ink/70"
                  />

                  <TableMessageRow
                    v-else-if="itemErrors[item.supply_id]"
                    :colspan="detailColspan"
                    :message="itemErrors[item.supply_id] || ''"
                    variant="error"
                    cell-class="px-3 py-3"
                    message-class="px-3 py-3 text-sm text-red-700"
                  />

                  <TableMessageRow
                    v-else-if="(supplyItems[item.supply_id] || []).length === 0"
                    :colspan="detailColspan"
                    message="Для этой поставки товаров нет."
                    cell-class="px-3 py-3"
                    message-class="px-3 py-3 text-sm text-ink/70"
                  />

                  <template v-else>
                    <tr
                      v-for="supplyItem in supplyItems[item.supply_id] || []"
                      :key="itemRowKey(item.supply_id, supplyItem)"
                      class="border-t border-sand/60 bg-[#f8f3ed] text-[13px]"
                    >
                      <td class="px-3 py-2"></td>
                      <td v-for="column in itemColumns" :key="column.key" class="px-3 py-2 text-ink">
                        <template v-if="column.key === 'article'">
                          <SupplyArticleCell :item="supplyItem" />
                        </template>
                        <template v-else-if="column.key === 'unit_cogs'">
                          <SupplyCostEditor
                            :draft-value="costState(item.supply_id, supplyItem).draftValue"
                            :is-saving="costState(item.supply_id, supplyItem).isSaving"
                            :is-article-saving="costState(item.supply_id, supplyItem).isArticleSaving"
                            :is-success="costState(item.supply_id, supplyItem).isSuccess"
                            :error-message="costState(item.supply_id, supplyItem).errorMessage"
                            @update:draft-value="emit('updateCostDraft', item.supply_id, supplyItem, $event)"
                            @save="emit('saveCost', item.supply_id, supplyItem)"
                            @save-article="emit('saveArticleCost', item.supply_id, supplyItem)"
                          />
                        </template>
                        <template v-else>
                          {{ formatSupplyItemValue(supplyItem, column.key) }}
                        </template>
                      </td>
                    </tr>
                  </template>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  SUPPLY_ITEM_COLUMNS,
  SUPPLY_LIST_COLUMNS,
  formatSupplyItemCell,
  formatSupplyListCell,
  type SupplyItemColumnKey,
} from '../../../entities/supplies/model/columns'
import type { Supply, SupplyItem, SupplyItemCostState } from '../../../entities/supplies/model/types'
import SupplyArticleCell from './SupplyArticleCell.vue'
import SupplyCostEditor from './SupplyCostEditor.vue'
import TableExpandButton from '../../../shared/ui/table/TableExpandButton.vue'
import TableMessageRow from '../../../shared/ui/table/TableMessageRow.vue'

interface Props {
  items: Supply[]
  supplyItems: Record<number, SupplyItem[]>
  expandedIds: number[]
  loadingItemIds: number[]
  itemErrors: Record<number, string | null>
  getItemRowKey: (supplyId: number, item: SupplyItem) => string
  getCostState: (supplyId: number, item: SupplyItem) => SupplyItemCostState
  selectedAccountName: string | null
  isLoading: boolean
  errorMessage: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleItems: [item: Supply]
  updateCostDraft: [supplyId: number, item: SupplyItem, value: string]
  saveCost: [supplyId: number, item: SupplyItem]
  saveArticleCost: [supplyId: number, item: SupplyItem]
}>()

const listColumns = SUPPLY_LIST_COLUMNS
const itemColumns = SUPPLY_ITEM_COLUMNS
const detailColspan = computed(() => listColumns.length)

function isExpanded(id: number): boolean {
  return props.expandedIds.includes(id)
}

function isRowLoading(id: number): boolean {
  return props.loadingItemIds.includes(id)
}

function formatSupplyItemValue(item: SupplyItem, key: SupplyItemColumnKey): string | number {
  return formatSupplyItemCell(item, key)
}

function itemRowKey(supplyId: number, item: SupplyItem): string {
  return props.getItemRowKey(supplyId, item)
}

function costState(supplyId: number, item: SupplyItem): SupplyItemCostState {
  return props.getCostState(supplyId, item)
}
</script>
