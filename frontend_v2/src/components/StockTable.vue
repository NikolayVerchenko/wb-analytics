<template>
  <div class="card stack">
    <slot name="header">
      <h3>Остатки товаров</h3>
    </slot>

    <div class="table-wrapper stock-table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="sticky-photo-header">Фото</th>
            <th class="article-header sticky-article-header">Артикул</th>
            <th>Размер</th>
            <th>Себестоимость, ед</th>
            <th>На складах</th>
            <th>До клиента</th>
            <th>Возвраты в пути</th>
            <th>Общий остаток</th>
            <th>Себестоимость остатка</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="totals" class="totals-row">
            <td class="sticky-photo-cell"></td>
            <td class="article-column sticky-article-cell">
              <div class="article-cell">
                <span class="article-main">Итого</span>
              </div>
            </td>
            <td>-</td>
            <td class="numeric">{{ formatNumber(totals.cogs_per_unit) }}</td>
            <td class="numeric">{{ formatNumber(totals.total_on_warehouses) }}</td>
            <td class="numeric">{{ formatNumber(totals.in_transit_to_customer) }}</td>
            <td class="numeric">{{ formatNumber(totals.in_transit_from_customer) }}</td>
            <td class="numeric">{{ formatNumber(totals.total_stock) }}</td>
            <td class="numeric">{{ formatNumber(totals.stock_cogs_total) }}</td>
          </tr>
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
              <td>{{ item.tech_size || '-' }}</td>
              <td class="numeric">{{ formatNumber(item.cogs_per_unit) }}</td>
              <td class="numeric">{{ formatNumber(item.total_on_warehouses) }}</td>
              <td class="numeric">{{ formatNumber(item.in_transit_to_customer) }}</td>
              <td class="numeric">{{ formatNumber(item.in_transit_from_customer) }}</td>
              <td class="numeric">{{ formatNumber(item.total_stock) }}</td>
              <td class="numeric">{{ formatNumber(item.stock_cogs_total) }}</td>
            </tr>

            <tr v-if="isExpanded(item) && warehousesLoadingByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="9">
                <div class="message message-info">Загрузка складов...</div>
              </td>
            </tr>

            <tr v-else-if="isExpanded(item) && warehousesErrorByItem[getItemKey(item)]" class="sizes-row">
              <td colspan="9">
                <div class="message message-error">{{ warehousesErrorByItem[getItemKey(item)] }}</div>
              </td>
            </tr>

            <tr v-else-if="isExpanded(item) && (warehousesByItem[getItemKey(item)] ?? []).length === 0" class="sizes-row">
              <td colspan="9">
                <div class="message message-empty">Склады не найдены.</div>
              </td>
            </tr>

            <tr
              v-for="warehouse in isExpanded(item) ? warehousesByItem[getItemKey(item)] ?? [] : []"
              :key="`${getItemKey(item)}-${warehouse.warehouse_name}`"
              class="size-detail-row"
            >
              <td class="sticky-photo-cell"></td>
              <td class="sticky-article-cell"></td>
              <td colspan="6">{{ warehouse.warehouse_name }}</td>
              <td class="numeric">{{ formatNumber(warehouse.quantity) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StockItem, StockTotals, StockWarehouse } from '../types/stocks'
import { formatNumber } from '../utils/format'

const props = defineProps<{
  items: StockItem[]
  totals: StockTotals | null
  expandedItemKeys: string[]
  warehousesByItem: Record<string, StockWarehouse[]>
  warehousesLoadingByItem: Record<string, boolean>
  warehousesErrorByItem: Record<string, string>
}>()

const emit = defineEmits<{
  'toggle-item': [StockItem]
}>()

const expandedItemKeysSet = computed(() => new Set(props.expandedItemKeys))

function getItemKey(item: StockItem): string {
  return `${item.vendor_code || 'empty'}-${item.nm_id || 'empty'}-${item.tech_size || 'empty'}`
}

function canExpandItem(item: StockItem): boolean {
  return item.nm_id !== null && item.vendor_code !== null && item.tech_size !== null
}

function isExpanded(item: StockItem): boolean {
  return expandedItemKeysSet.value.has(getItemKey(item))
}
</script>
