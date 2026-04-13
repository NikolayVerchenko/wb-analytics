<template>
  <div class="card stack">
    <slot name="header">
      <h3>Товары</h3>
    </slot>

    <div class="table-wrapper economics-table-wrapper">
      <table class="economics-table">
        <thead>
          <tr class="table-header-row">
            <th class="sticky-photo-header">Фото</th>
            <th class="article-header sticky-article-header">Артикул</th>
            <th class="size-header">Размер</th>
            <th><span>Количество</span><br /><span>заказов</span></th>
            <th><span>Количество</span><br /><span>доставок</span></th>
            <th><span>Количество</span><br /><span>отказов</span></th>
            <th><span>Количество</span><br /><span>возвратов</span></th>
            <th><span>Количество</span><br /><span>продаж</span></th>
            <th>% выкупа</th>
            <th><span>Реализация</span><br /><span>до СПП</span></th>
            <th><span>Реализация</span><br /><span>после СПП</span></th>
            <th>СПП</th>
            <th>% СПП</th>
            <th><span>Перечисления</span><br /><span>продавцу</span></th>
            <th><span>Комиссия</span><br /><span>ВБ</span></th>
            <th><span>% комиссии</span><br /><span>ВБ</span></th>
            <th>Логистика</th>
            <th><span>Логистика</span><br /><span>на ед.</span></th>
            <th>Хранение</th>
            <th><span>Хранение</span><br /><span>на ед.</span></th>
            <th><span>Платная</span><br /><span>приемка</span></th>
            <th>Штрафы</th>
            <th>Реклама</th>
            <th><span>Реклама</span><br /><span>на ед.</span></th>
            <th>Налог</th>
            <th><span>Налог</span><br /><span>на ед.</span></th>
            <th>Себестоимость</th>
            <th><span>Себестоимость</span><br /><span>на ед.</span></th>
            <th>Прибыль</th>
            <th><span>Прибыль</span><br /><span>на ед.</span></th>
            <th>Маржа, %</th>
            <th>ROI, %</th>
          </tr>
          <tr v-if="totals" class="totals-row totals-row-strong">
            <td class="sticky-photo-cell"></td>
            <td class="article-column sticky-article-cell">
              <div class="article-cell">
                <span class="article-main">Итого</span>
              </div>
            </td>
            <td class="size-column">-</td>
            <td class="numeric">{{ formatNumber(totals.order_count) }}</td>
            <td class="numeric">{{ formatNumber(totals.delivery_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.refusal_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.return_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatPercent(totals.buyout_percent) }}</td>
            <td class="numeric">{{ formatNumber(totals.realization_before_spp) }}</td>
            <td class="numeric">{{ formatNumber(totals.realization_after_spp) }}</td>
            <td class="numeric">{{ formatNumber(totals.spp_amount) }}</td>
            <td class="numeric">{{ formatPercent(totals.spp_percent) }}</td>
            <td class="numeric">{{ formatNumber(totals.seller_transfer) }}</td>
            <td class="numeric">{{ formatNumber(totals.wb_commission_amount) }}</td>
            <td class="numeric">{{ formatPercent(totals.wb_commission_percent) }}</td>
            <td class="numeric">
              {{ formatNumber(totals.delivery_cost) }}
              <div v-if="hasDeliveryCorrection(totals.delivery_cost_correction)" class="cell-subnote">
                корр.: {{ formatNumber(totals.delivery_cost_correction) }}
              </div>
            </td>
            <td class="numeric">{{ formatPerSale(totals.delivery_cost, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.paid_storage_cost) }}</td>
            <td class="numeric">{{ formatPerSale(totals.paid_storage_cost, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.acceptance_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.penalty_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.advert_cost) }}</td>
            <td class="numeric">{{ formatPerSale(totals.advert_cost, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.tax_amount) }}</td>
            <td class="numeric">{{ formatPerSale(totals.tax_amount, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.cogs_amount) }}</td>
            <td class="numeric">{{ formatPerSale(totals.cogs_amount, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.profit_amount) }}</td>
            <td class="numeric">{{ formatPerSale(totals.profit_amount, totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatPercent(totals.margin_percent) }}</td>
            <td class="numeric">{{ formatPercent(totals.roi_percent) }}</td>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in items" :key="getItemKey(item)">
            <tr
              :class="[
                'item-row',
                {
                  'item-row-expanded': isExpandedRow(item),
                  'item-row-collapsible': isExpandableRow(item),
                  'item-row-disabled': !isExpandableRow(item),
                },
                getRowPriorityClass(item),
              ]"
              @click="toggleRow(item)"
            >
              <td class="sticky-photo-cell">
                <img
                  v-if="item.photo_url"
                  :src="item.photo_url"
                  :alt="item.vendor_code || 'Товар'"
                  class="product-photo"
                />
                <span v-else>-</span>
              </td>
              <td class="article-column sticky-article-cell">
                <div class="article-cell article-cell-main">
                  <button
                    v-if="isExpandableRow(item)"
                    class="row-toggle"
                    type="button"
                    :aria-label="isExpandedRow(item) ? 'Свернуть размеры' : 'Показать размеры'"
                    :aria-expanded="isExpandedRow(item)"
                    @click.stop="toggleRow(item)"
                  >
                    <span class="row-toggle-icon" :data-open="isExpandedRow(item)">▸</span>
                  </button>
                  <span v-else class="row-toggle-placeholder"></span>
                  <span class="article-main">{{ item.vendor_code || '-' }}</span>
                  <span class="article-sub">{{ formatNumber(item.nm_id) }}</span>
                </div>
              </td>
              <td class="size-column">-</td>
              <td class="numeric">{{ formatNumber(item.order_count) }}</td>
              <td class="numeric">{{ formatNumber(item.delivery_quantity) }}</td>
              <td :class="['numeric', getRefusalCellClass(item.refusal_quantity)]">
                {{ formatNumber(item.refusal_quantity) }}
              </td>
              <td :class="['numeric', getReturnCellClass(item.return_quantity)]">
                {{ formatNumber(item.return_quantity) }}
              </td>
              <td class="numeric">{{ formatNumber(item.sales_quantity) }}</td>
              <td :class="['numeric', getBuyoutCellClass(item.buyout_percent)]">
                {{ formatPercent(item.buyout_percent) }}
              </td>
              <td class="numeric">{{ formatNumber(item.realization_before_spp) }}</td>
              <td class="numeric">{{ formatNumber(item.realization_after_spp) }}</td>
              <td class="numeric">{{ formatNumber(item.spp_amount) }}</td>
              <td class="numeric">{{ formatPercent(item.spp_percent) }}</td>
              <td class="numeric">{{ formatNumber(item.seller_transfer) }}</td>
              <td class="numeric">{{ formatNumber(item.wb_commission_amount) }}</td>
              <td class="numeric">{{ formatPercent(item.wb_commission_percent) }}</td>
              <td class="numeric">
                {{ formatNumber(item.delivery_cost) }}
                <div v-if="hasDeliveryCorrection(item.delivery_cost_correction)" class="cell-subnote">
                  корр.: {{ formatNumber(item.delivery_cost_correction) }}
                </div>
              </td>
              <td class="numeric">{{ formatPerSale(item.delivery_cost, item.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.paid_storage_cost) }}</td>
              <td class="numeric">{{ formatPerSale(item.paid_storage_cost, item.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.acceptance_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.penalty_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.advert_cost) }}</td>
              <td class="numeric">{{ formatPerSale(item.advert_cost, item.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.tax_amount) }}</td>
              <td class="numeric">{{ formatPerSale(item.tax_amount, item.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.cogs_amount) }}</td>
              <td class="numeric">{{ formatPerSale(item.cogs_amount, item.sales_quantity) }}</td>
              <td :class="['numeric', getProfitCellClass(item.profit_amount)]">
                {{ formatNumber(item.profit_amount) }}
              </td>
              <td class="numeric">{{ formatPerSale(item.profit_amount, item.sales_quantity) }}</td>
              <td :class="['numeric', getMarginCellClass(item.margin_percent)]">
                {{ formatPercent(item.margin_percent) }}
              </td>
              <td :class="['numeric', getRoiCellClass(item.roi_percent)]">
                {{ formatPercent(item.roi_percent) }}
              </td>
            </tr>

            <tr v-if="isExpandedRow(item) && sizesLoadingByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="32">
                <div class="message message-info">Загрузка размеров...</div>
              </td>
            </tr>

            <tr v-else-if="isExpandedRow(item) && sizesErrorByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="32">
                <div class="message message-error">{{ sizesErrorByItem[getItemKey(item)] }}</div>
              </td>
            </tr>

            <tr
              v-else-if="isExpandedRow(item) && (sizesByItem[getItemKey(item)] ?? []).length === 0"
              class="sizes-row"
            >
              <td colspan="32">
                <div class="message message-empty">Размеры не найдены.</div>
              </td>
            </tr>

            <tr
              v-for="size in isExpandedRow(item) ? sizesByItem[getItemKey(item)] ?? [] : []"
              :key="`${getItemKey(item)}-${size.ts_name || 'empty'}`"
              class="size-detail-row"
            >
              <td class="sticky-photo-cell"></td>
              <td class="sticky-article-cell size-article-cell">
                <div class="size-branch">
                  <span class="size-branch-line"></span>
                </div>
              </td>
              <td class="size-column size-label">
                <span class="size-label-dot"></span>
                <span class="size-label-text">Размер {{ size.ts_name || '-' }}</span>
              </td>
              <td class="numeric">-</td>
              <td class="numeric">{{ formatNumber(size.delivery_quantity) }}</td>
              <td :class="['numeric', getRefusalCellClass(size.refusal_quantity)]">
                {{ formatNumber(size.refusal_quantity) }}
              </td>
              <td :class="['numeric', getReturnCellClass(size.return_quantity)]">
                {{ formatNumber(size.return_quantity) }}
              </td>
              <td class="numeric">{{ formatNumber(size.sales_quantity) }}</td>
              <td :class="['numeric', 'size-cell', getBuyoutCellClass(size.buyout_percent)]">
                {{ formatPercent(size.buyout_percent) }}
              </td>
              <td class="numeric">{{ formatNumber(size.realization_before_spp) }}</td>
              <td class="numeric">{{ formatNumber(size.realization_after_spp) }}</td>
              <td class="numeric">{{ formatNumber(size.spp_amount) }}</td>
              <td class="numeric">{{ formatPercent(size.spp_percent) }}</td>
              <td class="numeric">{{ formatNumber(size.seller_transfer) }}</td>
              <td class="numeric">{{ formatNumber(size.wb_commission_amount) }}</td>
              <td class="numeric">{{ formatPercent(size.wb_commission_percent) }}</td>
              <td class="numeric">
                {{ formatNumber(size.delivery_cost) }}
                <div v-if="hasDeliveryCorrection(size.delivery_cost_correction)" class="cell-subnote">
                  корр.: {{ formatNumber(size.delivery_cost_correction) }}
                </div>
              </td>
              <td class="numeric">{{ formatPerSale(size.delivery_cost, size.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(size.paid_storage_cost) }}</td>
              <td class="numeric">{{ formatPerSale(size.paid_storage_cost, size.sales_quantity) }}</td>
              <td class="numeric">-</td>
              <td class="numeric">{{ formatNumber(size.penalty_cost) }}</td>
              <td class="numeric">-</td>
              <td class="numeric">-</td>
              <td class="numeric">{{ formatNumber(size.tax_amount) }}</td>
              <td class="numeric">{{ formatPerSale(size.tax_amount, size.sales_quantity) }}</td>
              <td class="numeric">{{ formatNumber(size.cogs_amount) }}</td>
              <td class="numeric">{{ formatPerSale(size.cogs_amount, size.sales_quantity) }}</td>
              <td :class="['numeric', 'size-cell', getProfitCellClass(size.profit_amount)]">
                {{ formatNumber(size.profit_amount) }}
              </td>
              <td class="numeric">{{ formatPerSale(size.profit_amount, size.sales_quantity) }}</td>
              <td :class="['numeric', 'size-cell', getMarginCellClass(size.margin_percent)]">
                {{ formatPercent(size.margin_percent) }}
              </td>
              <td :class="['numeric', 'size-cell', getRoiCellClass(size.roi_percent)]">
                {{ formatPercent(size.roi_percent) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EconomicsItem, EconomicsSizeItem, EconomicsTotals } from '../types/economics'
import { formatNumber, formatPercent } from '../utils/format'

const props = defineProps<{
  items: EconomicsItem[]
  totals: EconomicsTotals | null
  expandedItemKeys: string[]
  sizesByItem: Record<string, EconomicsSizeItem[]>
  sizesLoadingByItem: Record<string, boolean>
  sizesErrorByItem: Record<string, string>
}>()

const emit = defineEmits<{
  'toggle-item': [EconomicsItem]
}>()

const expandedItemKeysSet = computed(() => new Set(props.expandedItemKeys))

function getItemKey(item: EconomicsItem): string {
  return `${item.vendor_code || 'empty'}-${item.nm_id || 'empty'}`
}

function canExpandItem(item: EconomicsItem): boolean {
  return item.nm_id !== null && item.vendor_code !== null && item.vendor_code.length > 0
}

function isExpanded(item: EconomicsItem): boolean {
  return expandedItemKeysSet.value.has(getItemKey(item))
}

function isExpandableRow(item: EconomicsItem): boolean {
  return canExpandItem(item)
}

function isExpandedRow(item: EconomicsItem): boolean {
  return isExpanded(item)
}

function toggleRow(item: EconomicsItem) {
  if (!isExpandableRow(item)) {
    return
  }
  emit('toggle-item', item)
}

function formatPerSale(value: number | null | undefined, salesQuantity: number | null | undefined): string {
  if (value == null || salesQuantity == null || salesQuantity <= 0) {
    return '-'
  }

  return formatNumber(value / salesQuantity)
}

function hasDeliveryCorrection(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Math.abs(value) > 0.0001
}

function getBuyoutState(value: number | null | undefined) {
  if (value == null) {
    return 'neutral'
  }
  if (value >= 70) {
    return 'positive'
  }
  if (value >= 50) {
    return 'warning'
  }
  return 'negative'
}

function getScalarState(value: number | null | undefined) {
  if (value == null || value === 0) {
    return 'neutral'
  }
  return value > 0 ? 'positive' : 'negative'
}

function getRefusalCellClass(value: number | null | undefined) {
  if (!value) {
    return ''
  }
  return value > 5 ? 'cell-negative' : 'cell-warning'
}

function getReturnCellClass(value: number | null | undefined) {
  if (!value) {
    return ''
  }
  return value > 2 ? 'cell-negative' : 'cell-warning'
}

function getBuyoutCellClass(value: number | null | undefined) {
  const state = getBuyoutState(value)
  return state === 'neutral' ? '' : `cell-${state}`
}

function getProfitCellClass(value: number | null | undefined) {
  const state = getScalarState(value)
  return state === 'neutral' ? '' : `cell-${state}`
}

function getMarginCellClass(value: number | null | undefined) {
  const state = getScalarState(value)
  return state === 'neutral' ? '' : `cell-${state}`
}

function getRoiCellClass(value: number | null | undefined) {
  const state = getScalarState(value)
  return state === 'neutral' ? '' : `cell-${state}`
}

function getRowPriorityClass(item: EconomicsItem) {
  const buyout = item.buyout_percent ?? null
  const refusal = item.refusal_quantity ?? 0
  const returns = item.return_quantity ?? 0
  const profit = item.profit_amount ?? 0
  if (profit < 0 || (buyout !== null && buyout < 40) || refusal > 5 || returns > 2) {
    return 'row-priority-high'
  }
  if ((buyout !== null && buyout < 60) || refusal > 0 || returns > 0) {
    return 'row-priority-medium'
  }
  return ''
}
</script>

<style scoped>
.item-row-disabled {
  cursor: default;
}

.item-row-disabled:hover td,
.item-row-disabled:hover .sticky-photo-cell,
.item-row-disabled:hover .sticky-article-cell {
  background: #ffffff;
}

.row-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  color: #6b7280;
  padding: 0;
}

.row-toggle:hover {
  border-color: #cbd5f5;
  color: #4c1d95;
}

.row-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: transform 0.15s ease;
}

.row-toggle-icon[data-open='true'] {
  transform: rotate(90deg);
}

.row-toggle-placeholder {
  display: inline-block;
  width: 22px;
  height: 22px;
  margin-right: 6px;
}

.size-detail-row td {
  background: #f9fafb;
  color: #4b5563;
}

.size-detail-row .sticky-photo-cell,
.size-detail-row .sticky-article-cell {
  background: #f9fafb;
}

.size-detail-row:hover td {
  background: #f8fafc;
}

.size-detail-row:hover .sticky-photo-cell,
.size-detail-row:hover .sticky-article-cell {
  background: #f8fafc;
}

.size-article-cell {
  padding-left: 8px;
  padding-right: 8px;
}

.size-branch {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
}

.size-branch-line {
  width: 12px;
  height: 24px;
  border-left: 1px solid #d1d5db;
  border-bottom: 1px solid #d1d5db;
  border-bottom-left-radius: 6px;
}

.size-label {
  text-align: left;
  padding-left: 4px;
}

.size-label-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 999px;
  background: #c7d2fe;
  vertical-align: middle;
}

.size-label-text {
  font-size: 13px;
  color: #4b5563;
}

.size-detail-row .cell-positive {
  color: #166534;
  opacity: 0.85;
  font-weight: 600;
}

.size-detail-row .cell-warning {
  color: #92400e;
  opacity: 0.8;
}

.size-detail-row .cell-negative {
  color: #b91c1c;
  opacity: 0.85;
  font-weight: 600;
}

.cell-subnote {
  margin-top: 2px;
  font-size: 11px;
  color: #6b7280;
}
</style>
