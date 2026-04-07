<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Поставки</h2>
        <p class="page-description">
          Страница читает `account_id` из query params и показывает поставки из `/api/supplies`.
          Здесь задаётся `unit_cogs`, который потом участвует в расчёте себестоимости.
        </p>
      </div>

      <div class="filters">
        <div class="field">
          <label for="supplies-account-id">Account ID</label>
          <input id="supplies-account-id" :value="accountId || ''" type="text" disabled />
        </div>
      </div>
    </div>

    <div v-if="!accountId" class="message message-empty">
      Выберите кабинет на странице кабинетов, чтобы открыть поставки.
    </div>

    <template v-else>
      <div v-if="loading" class="message message-info">Загрузка поставок...</div>
      <div v-else-if="error" class="message message-error">{{ error }}</div>
      <div v-else-if="supplies.length === 0" class="message message-empty">Поставки не найдены.</div>

      <div v-else class="stack">
        <article v-for="supply in supplies" :key="supply.supply_id" class="card stack">
          <button type="button" class="supply-header-button" @click="toggleSupply(supply.supply_id)">
            <div class="supply-header-grid">
              <div>
                <strong>Поставка #{{ supply.supply_id }}</strong>
                <div class="supply-meta">Создана: {{ formatDateTime(supply.create_date) }}</div>
              </div>
              <div class="supply-stat">Позиций: {{ formatNumber(supply.items_count) }}</div>
              <div class="supply-stat">План: {{ formatNumber(supply.planned_quantity) }}</div>
              <div class="supply-stat">Принято: {{ formatNumber(supply.accepted_quantity_total) }}</div>
            </div>
          </button>

          <div v-if="expandedSupplyIds.includes(supply.supply_id)" class="stack">
            <div v-if="itemsLoadingBySupply[supply.supply_id]" class="message message-info">Загрузка товаров поставки...</div>
            <div v-else-if="itemsErrorBySupply[supply.supply_id]" class="message message-error">{{ itemsErrorBySupply[supply.supply_id] }}</div>
            <div v-else-if="(itemsBySupply[supply.supply_id] ?? []).length === 0" class="message message-empty">Товары поставки не найдены.</div>

            <div v-else class="table-wrapper">
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
                        @input="setDraftValue(item, ($event.target as HTMLInputElement).value)"
                      />
                    </td>
                    <td>
                      <div class="supply-actions">
                        <button type="button" class="primary-button" :disabled="isSaving(item)" @click="saveItemCost(supply.supply_id, item)">
                          {{ isSaving(item) ? 'Сохранение...' : 'Сохранить' }}
                        </button>
                        <button type="button" class="account-button account-button-secondary" :disabled="isSaving(item)" @click="saveArticleCostForAllSizes(supply.supply_id, item)">
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
        </article>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSupplies, getSupplyItems, putSupplyArticleCostForAllSizes, putSupplyItemCost } from '../api/supplies'
import type { Supply, SupplyItem } from '../types/supplies'
import { formatNumber } from '../utils/format'

const route = useRoute()

const accountId = computed(() => (typeof route.query.account_id === 'string' ? route.query.account_id : ''))
const supplies = ref<Supply[]>([])
const loading = ref(false)
const error = ref('')
const expandedSupplyIds = ref<number[]>([])
const itemsBySupply = ref<Record<number, SupplyItem[]>>({})
const itemsLoadingBySupply = ref<Record<number, boolean>>({})
const itemsErrorBySupply = ref<Record<number, string>>({})
const itemCostDrafts = ref<Record<string, string>>({})
const savingKeys = ref<string[]>([])
const itemMessages = ref<Record<string, string>>({})

function getItemKey(item: SupplyItem): string {
  return `${item.supply_id}-${item.vendor_code}-${item.tech_size || ''}-${item.barcode || ''}-${item.nm_id}`
}

function getDraftValue(item: SupplyItem): string {
  const key = getItemKey(item)
  if (key in itemCostDrafts.value) {
    return itemCostDrafts.value[key]
  }
  return item.unit_cogs == null ? '' : String(item.unit_cogs)
}

function setDraftValue(item: SupplyItem, value: string) {
  itemCostDrafts.value[getItemKey(item)] = value
  itemMessages.value[getItemKey(item)] = ''
}

function isSaving(item: SupplyItem): boolean {
  return savingKeys.value.includes(getItemKey(item))
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU')
}

async function loadSupplies() {
  if (!accountId.value) {
    supplies.value = []
    return
  }

  loading.value = true
  error.value = ''
  expandedSupplyIds.value = []
  itemsBySupply.value = {}
  itemsLoadingBySupply.value = {}
  itemsErrorBySupply.value = {}
  itemCostDrafts.value = {}
  itemMessages.value = {}

  try {
    supplies.value = await getSupplies({ account_id: accountId.value })
  } catch (err) {
    supplies.value = []
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить поставки.'
  } finally {
    loading.value = false
  }
}

async function loadSupplyItems(supplyId: number) {
  if (!accountId.value || itemsBySupply.value[supplyId]) {
    return
  }

  itemsLoadingBySupply.value[supplyId] = true
  itemsErrorBySupply.value[supplyId] = ''

  try {
    itemsBySupply.value[supplyId] = await getSupplyItems(supplyId, { account_id: accountId.value })
  } catch (err) {
    itemsErrorBySupply.value[supplyId] = err instanceof Error ? err.message : 'Не удалось загрузить товары поставки.'
  } finally {
    itemsLoadingBySupply.value[supplyId] = false
  }
}

async function toggleSupply(supplyId: number) {
  if (expandedSupplyIds.value.includes(supplyId)) {
    expandedSupplyIds.value = expandedSupplyIds.value.filter((id) => id !== supplyId)
    return
  }

  expandedSupplyIds.value = [...expandedSupplyIds.value, supplyId]
  await loadSupplyItems(supplyId)
}

async function saveItemCost(supplyId: number, item: SupplyItem) {
  const key = getItemKey(item)
  const rawValue = getDraftValue(item).trim()
  const unitCogs = Number(rawValue)
  if (!rawValue || Number.isNaN(unitCogs) || unitCogs <= 0) {
    itemMessages.value[key] = 'Введите корректную себестоимость.'
    return
  }

  savingKeys.value = [...savingKeys.value, key]
  itemMessages.value[key] = ''

  try {
    await putSupplyItemCost(supplyId, accountId.value, {
      nm_id: item.nm_id,
      vendor_code: item.vendor_code,
      tech_size: item.tech_size,
      barcode: item.barcode,
      unit_cogs: unitCogs,
    })
    item.unit_cogs = unitCogs
    itemMessages.value[key] = 'Сохранено.'
  } catch (err) {
    itemMessages.value[key] = err instanceof Error ? err.message : 'Не удалось сохранить себестоимость.'
  } finally {
    savingKeys.value = savingKeys.value.filter((value) => value !== key)
  }
}

async function saveArticleCostForAllSizes(supplyId: number, item: SupplyItem) {
  const key = getItemKey(item)
  const rawValue = getDraftValue(item).trim()
  const unitCogs = Number(rawValue)
  if (!rawValue || Number.isNaN(unitCogs) || unitCogs <= 0) {
    itemMessages.value[key] = 'Введите корректную себестоимость.'
    return
  }

  savingKeys.value = [...savingKeys.value, key]
  itemMessages.value[key] = ''

  try {
    await putSupplyArticleCostForAllSizes(supplyId, accountId.value, {
      nm_id: item.nm_id,
      vendor_code: item.vendor_code,
      unit_cogs: unitCogs,
    })
    for (const row of itemsBySupply.value[supplyId] ?? []) {
      if (row.nm_id === item.nm_id && row.vendor_code === item.vendor_code) {
        row.unit_cogs = unitCogs
        itemCostDrafts.value[getItemKey(row)] = String(unitCogs)
      }
    }
    itemMessages.value[key] = 'Сохранено для всех размеров.'
  } catch (err) {
    itemMessages.value[key] = err instanceof Error ? err.message : 'Не удалось сохранить себестоимость.'
  } finally {
    savingKeys.value = savingKeys.value.filter((value) => value !== key)
  }
}

watch(accountId, async () => {
  await loadSupplies()
}, { immediate: true })
</script>
