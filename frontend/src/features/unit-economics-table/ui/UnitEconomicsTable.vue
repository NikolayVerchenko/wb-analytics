<template>
  <section class="rounded-[28px] border border-sand/90 bg-white/80 p-6 shadow-panel backdrop-blur">
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 class="mt-2 text-2xl font-semibold tracking-tight text-ink">Артикулы за выбранный период</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            Один артикул показывается одной строкой за весь период. Размеры можно раскрыть прямо в таблице.
          </p>
        </div>

        <div class="flex justify-end">
      <div class="flex flex-wrap items-center gap-3">
        <slot name="toolbar-left" />
        <DateRangeFilter
            :date-from="dateFrom"
            :date-to="dateTo"
            :disabled="!canLoad || isLoading"
            @apply-range="emit('applyRange', $event)"
        />
      </div>
        </div>
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
        Загружаю строки экономики...
      </div>

      <div v-else-if="items.length === 0" class="rounded-2xl bg-paper px-4 py-6 text-sm text-ink/70">
        В выбранном периоде строк нет.
      </div>

      <div v-else class="overflow-hidden rounded-[24px] border border-sand">
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-sm">
            <thead class="bg-paper text-left text-[11px] uppercase tracking-[0.18em] text-ink/50">
              <tr>
                <th class="px-4 py-3"></th>
                <th v-for="column in leadingColumns" :key="column.key" class="px-4 py-3">{{ column.label }}</th>
                <th v-for="column in metricColumns" :key="column.key" class="px-4 py-3">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr class="border-t border-sand/80 bg-[#f4ece2] text-[13px] font-semibold text-ink">
                <td class="px-4 py-4"></td>
                <EconomicsLeadingCells
                  row-type="totals"
                  :totals="totals"
                  article-class="px-4 py-4"
                />
                <TableMetricCells
                  :columns="metricColumns"
                  :row="totals"
                  row-type="totals"
                  cell-class="px-4 py-4"
                />
              </tr>

              <template v-for="item in items" :key="itemKey(item)">
                <tr
                  class="cursor-pointer border-t border-sand/70 transition hover:bg-paper/45"
                  @click="canToggleItem(item) && emit('toggleSizes', item)"
                >
                  <td class="px-4 py-4">
                    <TableExpandButton
                      :expanded="isExpanded(itemKey(item))"
                      :is-loading="isRowLoading(itemKey(item))"
                      :disabled="!item.vendor_code"
                      @click.stop
                      @click="emit('toggleSizes', item)"
                    />
                  </td>
                  <EconomicsLeadingCells row-type="item" :item="item" />
                  <TableMetricCells
                    :columns="metricColumns"
                    :row="item"
                    row-type="item"
                    cell-class="px-4 py-4 text-ink"
                  />
                </tr>

                <template v-if="isExpanded(itemKey(item))">
                  <TableMessageRow v-if="isRowLoading(itemKey(item))" :colspan="detailColspan" message="Загружаю размеры..." />
                  <TableMessageRow v-else-if="sizeErrors[itemKey(item)]" :colspan="detailColspan" :message="sizeErrors[itemKey(item)] || ''" variant="error" />
                  <TableMessageRow v-else-if="(sizeItems[itemKey(item)] || []).length === 0" :colspan="detailColspan" message="Для этого товара нет размерной детализации." />

                  <template v-else>
                    <tr v-for="(size, index) in sizeItems[itemKey(item)] || []" :key="`${itemKey(item)}|${size.ts_name ?? 'empty'}|${index}`" class="border-t border-sand/60 bg-[#f8f3ed] text-[13px]">
                      <td class="px-4 py-3"></td>
                      <EconomicsLeadingCells
                        row-type="size"
                        :size="size"
                        article-class="px-4 py-3"
                      />
                      <TableMetricCells
                        :columns="metricColumns"
                        :row="size"
                        row-type="size"
                        cell-class="px-4 py-3 text-ink"
                      />
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

import { ECONOMICS_LEADING_COLUMNS, ECONOMICS_METRIC_COLUMNS } from '../../../entities/economics/model/columns'
import type { EconomicsPeriodItem, EconomicsPeriodSize, EconomicsPeriodTotals } from '../../../entities/economics/model/types'
import DateRangeFilter from '../../../shared/ui/filters/DateRangeFilter.vue'
import EconomicsLeadingCells from './EconomicsLeadingCells.vue'
import TableExpandButton from '../../../shared/ui/table/TableExpandButton.vue'
import TableMetricCells from '../../../shared/ui/table/TableMetricCells.vue'
import TableMessageRow from '../../../shared/ui/table/TableMessageRow.vue'

interface Props {
  items: EconomicsPeriodItem[]
  totals: EconomicsPeriodTotals | null
  sizeItems: Record<string, EconomicsPeriodSize[]>
  expandedKeys: string[]
  loadingSizeKeys: string[]
  sizeErrors: Record<string, string | null>
  dateFrom: string
  dateTo: string
  selectedAccountName: string | null
  isLoading: boolean
  errorMessage: string | null
  canLoad: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  applyRange: [payload: { dateFrom: string; dateTo: string }]
  toggleSizes: [item: EconomicsPeriodItem]
}>()

const leadingColumns = ECONOMICS_LEADING_COLUMNS
const metricColumns = ECONOMICS_METRIC_COLUMNS
const detailColspan = computed(() => 3 + metricColumns.length)

function itemKey(item: EconomicsPeriodItem): string {
  return `${item.nm_id}|${item.vendor_code ?? ''}`
}

function isExpanded(key: string): boolean {
  return props.expandedKeys.includes(key)
}

function isRowLoading(key: string): boolean {
  return props.loadingSizeKeys.includes(key)
}

function canToggleItem(item: EconomicsPeriodItem): boolean {
  return Boolean(item.vendor_code) && !isRowLoading(itemKey(item))
}
</script>
