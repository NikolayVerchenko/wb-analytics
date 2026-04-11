<template>
  <div class="supplies-table-card">
    <div class="section-toolbar">
      <div class="section-toolbar-title">
        <h3 class="section-title">Список поставок</h3>
        <p class="supplies-table-meta">
          Откройте поставку, чтобы посмотреть состав товаров и задать себестоимость по SKU.
        </p>
      </div>
      <div class="section-toolbar-actions">
        <span class="account-pill">{{ supplies.length }} поставок</span>
      </div>
    </div>

    <div class="sync-coverage-table-wrapper">
      <table class="sync-coverage-table supplies-list-table">
        <thead>
          <tr>
            <th>Поставка</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Позиций</th>
            <th>План</th>
            <th>Принято</th>
            <th>Детали</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="supply in supplies" :key="supply.supply_id">
            <tr>
              <td>
                <div class="supplies-main-cell">
                  <strong>Поставка #{{ supply.supply_id }}</strong>
                  <span v-if="supply.preorder_id" class="supplies-row-meta">Предзаказ #{{ supply.preorder_id }}</span>
                </div>
              </td>
              <td>{{ formatSupplyDate(supply) }}</td>
              <td>
                <span class="supplies-status-badge" :data-status="getSupplyStatusMeta(supply).key">
                  {{ getSupplyStatusMeta(supply).label }}
                </span>
              </td>
              <td>{{ supply.items_count }}</td>
              <td>{{ formatNumber(supply.planned_quantity) }}</td>
              <td>{{ formatNumber(supply.accepted_quantity_total) }}</td>
              <td>
                <button type="button" class="secondary-button secondary-button-compact" @click="emit('toggleSupply', supply.supply_id)">
                  {{ isExpanded(supply.supply_id) ? 'Скрыть состав' : 'Открыть состав' }}
                </button>
              </td>
            </tr>
            <tr v-if="isExpanded(supply.supply_id)">
              <td colspan="7" class="supplies-details-cell">
                <div class="supplies-detail-panel">
                  <div v-if="itemsLoadingBySupply[supply.supply_id]" class="message message-info">Загрузка товаров поставки...</div>
                  <div v-else-if="itemsErrorBySupply[supply.supply_id]" class="message message-error">{{ itemsErrorBySupply[supply.supply_id] }}</div>
                  <div v-else-if="(itemsBySupply[supply.supply_id] ?? []).length === 0" class="message message-empty">Товары поставки не найдены.</div>
                  <div v-else class="table-wrapper stock-table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th class="sticky-photo-header">Фото</th>
                          <th class="sticky-article-header">Артикул</th>
                          <th>Размер</th>
                          <th>Штрихкод</th>
                          <th>План</th>
                          <th>Принято</th>
                          <th>Готово к продаже</th>
                          <th>Себестоимость, ед</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in itemsBySupply[supply.supply_id]" :key="getItemKey(item)">
                          <td class="sticky-photo-cell">
                            <img
                              v-if="item.photo_url"
                              :src="item.photo_url"
                              :alt="item.vendor_code || 'Товар'"
                              class="product-photo"
                            />
                            <span v-else>-</span>
                          </td>
                          <td class="sticky-article-cell">
                            <div class="article-cell">
                              <span class="article-main">{{ item.vendor_code }}</span>
                              <span class="article-sub">{{ formatNumber(item.nm_id) }}</span>
                            </div>
                          </td>
                          <td>{{ item.tech_size || '-' }}</td>
                          <td>{{ item.barcode || '-' }}</td>
                          <td class="numeric">{{ formatNumber(item.quantity) }}</td>
                          <td class="numeric">{{ formatNumber(item.accepted_quantity) }}</td>
                          <td class="numeric">{{ formatNumber(item.ready_for_sale_quantity) }}</td>
                          <td>
                            <input
                              :value="getDraftValue(item)"
                              type="number"
                              min="0"
                              step="0.01"
                              class="supply-cost-input"
                              @input="emit('setDraftValue', item, ($event.target as HTMLInputElement).value)"
                            />
                          </td>
                          <td>
                            <div class="supply-actions">
                              <button type="button" class="primary-button" :disabled="isSaving(item)" @click="emit('saveItemCost', supply.supply_id, item)">
                                {{ isSaving(item) ? 'Сохранение...' : 'Сохранить' }}
                              </button>
                              <button type="button" class="secondary-button secondary-button-compact" :disabled="isSaving(item)" @click="emit('saveArticleCostForAllSizes', supply.supply_id, item)">
                                На все размеры
                              </button>
                            </div>
                            <div v-if="itemMessages[getItemKey(item)]" class="supply-inline-message">{{ itemMessages[getItemKey(item)] }}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Supply, SupplyItem } from '../types/supplies'
import type { SupplyStatusMeta } from '../composables/useSuppliesPage'
import { formatNumber } from '../utils/format'

const props = defineProps<{
  supplies: Supply[]
  expandedSupplyIds: number[]
  itemsBySupply: Record<number, SupplyItem[]>
  itemsLoadingBySupply: Record<number, boolean>
  itemsErrorBySupply: Record<number, string>
  itemMessages: Record<string, string>
  getItemKey: (item: SupplyItem) => string
  getDraftValue: (item: SupplyItem) => string
  isSaving: (item: SupplyItem) => boolean
  formatDateTime: (value: string | null | undefined) => string
  getSupplyStatusMeta: (supply: Supply) => SupplyStatusMeta
}>()

const emit = defineEmits<{
  toggleSupply: [supplyId: number]
  setDraftValue: [item: SupplyItem, value: string]
  saveItemCost: [supplyId: number, item: SupplyItem]
  saveArticleCostForAllSizes: [supplyId: number, item: SupplyItem]
}>()

function isExpanded(supplyId: number) {
  return props.expandedSupplyIds.includes(supplyId)
}

function formatSupplyDate(supply: Supply) {
  return props.formatDateTime(supply.fact_date ?? supply.supply_date ?? supply.create_date ?? supply.updated_date)
}
</script>

<style scoped>
.supplies-table-card {
  display: grid;
  gap: 16px;
}

.supplies-table-meta {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.supplies-list-table td {
  vertical-align: middle;
}

.supplies-main-cell {
  display: grid;
  gap: 4px;
}

.supplies-row-meta {
  color: #6b7280;
  font-size: 12px;
}

.supplies-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.supplies-status-badge[data-status='accepted'] {
  background: #dcfce7;
  color: #166534;
}

.supplies-status-badge[data-status='partial'] {
  background: #fef3c7;
  color: #92400e;
}

.supplies-status-badge[data-status='planned'] {
  background: #eff6ff;
  color: #1d4ed8;
}

.supplies-details-cell {
  padding: 0;
  background: #f9fafb;
}

.supplies-detail-panel {
  padding: 16px;
  display: grid;
  gap: 12px;
}

.supply-cost-input {
  min-width: 120px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
}

.supply-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.supply-inline-message {
  margin-top: 8px;
  font-size: 13px;
  color: #1d4ed8;
}
</style>
