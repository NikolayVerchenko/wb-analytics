<template>
  <div class="card stack">
    <slot name="header">
      <h3>Товары</h3>
    </slot>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="sticky-photo-header">Фото</th>
            <th class="article-header sticky-article-header">Артикул</th>
            <th class="size-header">Размер</th>
            <th><span>Количество</span><br /><span>доставок</span></th>
            <th><span>Количество</span><br /><span>отказов</span></th>
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
            <th>Хранение</th>
            <th><span>Платная</span><br /><span>приемка</span></th>
            <th>Штрафы</th>
            <th>Реклама</th>
            <th>Налог</th>
            <th>Себестоимость</th>
            <th>Прибыль</th>
            <th>Маржа, %</th>
            <th>ROI, %</th>
          </tr>
          <tr v-if="totals" class="totals-row">
            <td class="sticky-photo-cell"></td>
            <td class="article-column sticky-article-cell">
              <div class="article-cell">
                <span class="article-main">Итого</span>
              </div>
            </td>
            <td class="size-column">-</td>
            <td class="numeric">{{ formatNumber(totals.delivery_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.refusal_quantity) }}</td>
            <td class="numeric">{{ formatNumber(totals.sales_quantity) }}</td>
            <td class="numeric">{{ formatPercent(totals.buyout_percent) }}</td>
            <td class="numeric">{{ formatNumber(totals.realization_before_spp) }}</td>
            <td class="numeric">{{ formatNumber(totals.realization_after_spp) }}</td>
            <td class="numeric">{{ formatNumber(totals.spp_amount) }}</td>
            <td class="numeric">{{ formatPercent(totals.spp_percent) }}</td>
            <td class="numeric">{{ formatNumber(totals.seller_transfer) }}</td>
            <td class="numeric">{{ formatNumber(totals.wb_commission_amount) }}</td>
            <td class="numeric">{{ formatPercent(totals.wb_commission_percent) }}</td>
            <td class="numeric">{{ formatNumber(totals.delivery_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.paid_storage_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.acceptance_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.penalty_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.advert_cost) }}</td>
            <td class="numeric">{{ formatNumber(totals.tax_amount) }}</td>
            <td class="numeric">{{ formatNumber(totals.cogs_amount) }}</td>
            <td class="numeric">{{ formatNumber(totals.profit_amount) }}</td>
            <td class="numeric">{{ formatPercent(totals.margin_percent) }}</td>
            <td class="numeric">{{ formatPercent(totals.roi_percent) }}</td>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in items" :key="getItemKey(item)">
            <tr
              :class="{ 'item-row': canExpandItem(item), 'item-row-expanded': isExpanded(item) }"
              @click="emit('toggle-item', item)"
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
                <div class="article-cell">
                  <span class="article-main">{{ item.vendor_code || '-' }}</span>
                  <span class="article-sub">{{ formatNumber(item.nm_id) }}</span>
                </div>
              </td>
              <td class="size-column">-</td>
              <td class="numeric">{{ formatNumber(item.delivery_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.refusal_quantity) }}</td>
              <td class="numeric">{{ formatNumber(item.sales_quantity) }}</td>
              <td class="numeric">{{ formatPercent(item.buyout_percent) }}</td>
              <td class="numeric">{{ formatNumber(item.realization_before_spp) }}</td>
              <td class="numeric">{{ formatNumber(item.realization_after_spp) }}</td>
              <td class="numeric">{{ formatNumber(item.spp_amount) }}</td>
              <td class="numeric">{{ formatPercent(item.spp_percent) }}</td>
              <td class="numeric">{{ formatNumber(item.seller_transfer) }}</td>
              <td class="numeric">{{ formatNumber(item.wb_commission_amount) }}</td>
              <td class="numeric">{{ formatPercent(item.wb_commission_percent) }}</td>
              <td class="numeric">{{ formatNumber(item.delivery_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.paid_storage_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.acceptance_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.penalty_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.advert_cost) }}</td>
              <td class="numeric">{{ formatNumber(item.tax_amount) }}</td>
              <td class="numeric">{{ formatNumber(item.cogs_amount) }}</td>
              <td class="numeric">{{ formatNumber(item.profit_amount) }}</td>
              <td class="numeric">{{ formatPercent(item.margin_percent) }}</td>
              <td class="numeric">{{ formatPercent(item.roi_percent) }}</td>
            </tr>

            <tr v-if="isExpanded(item) && sizesLoadingByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="24">
                <div class="message message-info">Загрузка размеров...</div>
              </td>
            </tr>

            <tr v-else-if="isExpanded(item) && sizesErrorByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="24">
                <div class="message message-error">{{ sizesErrorByItem[getItemKey(item)] }}</div>
              </td>
            </tr>

            <tr v-else-if="isExpanded(item) && (sizesByItem[getItemKey(item)] ?? []).length === 0" class="sizes-row">
              <td colspan="24">
                <div class="message message-empty">Размеры не найдены.</div>
              </td>
            </tr>

            <tr
              v-for="size in isExpanded(item) ? sizesByItem[getItemKey(item)] ?? [] : []"
              :key="`${getItemKey(item)}-${size.ts_name || 'empty'}`"
              class="size-detail-row"
            >
              <td class="sticky-photo-cell"></td>
              <td class="sticky-article-cell"></td>
              <td class="size-column">{{ size.ts_name || '-' }}</td>
              <td class="numeric">{{ formatNumber(size.delivery_quantity) }}</td>
              <td class="numeric">{{ formatNumber(size.refusal_quantity) }}</td>
              <td class="numeric">{{ formatNumber(size.sales_quantity) }}</td>
              <td class="numeric">{{ formatPercent(size.buyout_percent) }}</td>
              <td class="numeric">{{ formatNumber(size.realization_before_spp) }}</td>
              <td class="numeric">{{ formatNumber(size.realization_after_spp) }}</td>
              <td class="numeric">{{ formatNumber(size.spp_amount) }}</td>
              <td class="numeric">{{ formatPercent(size.spp_percent) }}</td>
              <td class="numeric">{{ formatNumber(size.seller_transfer) }}</td>
              <td class="numeric">{{ formatNumber(size.wb_commission_amount) }}</td>
              <td class="numeric">{{ formatPercent(size.wb_commission_percent) }}</td>
              <td class="numeric">{{ formatNumber(size.delivery_cost) }}</td>
              <td class="numeric">{{ formatNumber(size.paid_storage_cost) }}</td>
              <td class="numeric">-</td>
              <td class="numeric">{{ formatNumber(size.penalty_cost) }}</td>
              <td class="numeric">-</td>
              <td class="numeric">{{ formatNumber(size.tax_amount) }}</td>
              <td class="numeric">{{ formatNumber(size.cogs_amount) }}</td>
              <td class="numeric">{{ formatNumber(size.profit_amount) }}</td>
              <td class="numeric">{{ formatPercent(size.margin_percent) }}</td>
              <td class="numeric">{{ formatPercent(size.roi_percent) }}</td>
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
</script>
