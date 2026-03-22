<template>
  <section class="stack">
    <div class="card stack">
      <div>
        <h2 class="page-title">Юнит-экономика</h2>
        <p class="page-description">
          Страница читает `account_id`, `date_from` и `date_to` из query params и запрашивает
          `/api/economics/period-items`.
        </p>
      </div>

      <div class="filters">
        <div class="field">
          <label for="account-id">Account ID</label>
          <input id="account-id" :value="accountId || ''" type="text" disabled />
        </div>

        <PeriodFilter
          :date-from="form.date_from"
          :date-to="form.date_to"
          @apply="handlePeriodApply"
        />
      </div>
    </div>

    <div v-if="!accountId" class="message message-empty">
      Выберите кабинет на странице кабинетов, чтобы загрузить данные.
    </div>

    <template v-else>
      <div v-if="loading" class="message message-info">Загрузка данных...</div>
      <div v-else-if="error" class="message message-error">{{ error }}</div>
      <div v-else-if="items.length === 0" class="message message-empty">Нет данных за выбранный период.</div>

      <template v-else>
        <div v-if="totals" class="card stack">
          <h3>Итоги</h3>

          <div class="totals">
            <div class="totals-item">
              <span class="totals-label">Продажи</span>
              <span class="totals-value">{{ formatNumber(totals.sales_quantity) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">К перечислению</span>
              <span class="totals-value">{{ formatNumber(totals.seller_transfer) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Себестоимость</span>
              <span class="totals-value">{{ formatNumber(totals.cogs_amount) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Прибыль</span>
              <span class="totals-value">{{ formatNumber(totals.profit_amount) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">Маржа, %</span>
              <span class="totals-value">{{ formatPercent(totals.margin_percent) }}</span>
            </div>
            <div class="totals-item">
              <span class="totals-label">ROI, %</span>
              <span class="totals-value">{{ formatPercent(totals.roi_percent) }}</span>
            </div>
          </div>
        </div>

        <div class="card stack">
          <h3>Товары</h3>

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
              </thead>
              <tbody>
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
                <template v-for="item in items" :key="getItemKey(item)">
                  <tr
                    :class="{ 'item-row': canExpandItem(item), 'item-row-expanded': isExpanded(item) }"
                    @click="toggleItem(item)"
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
                    <td colspan="23">
                      <div class="message message-info">Загрузка размеров...</div>
                    </td>
                  </tr>

                  <tr v-else-if="isExpanded(item) && sizesErrorByItem[getItemKey(item)]" class="sizes-row">
                    <td colspan="23">
                      <div class="message message-error">{{ sizesErrorByItem[getItemKey(item)] }}</div>
                    </td>
                  </tr>

                  <tr
                    v-else-if="isExpanded(item) && (sizesByItem[getItemKey(item)] ?? []).length === 0"
                    class="sizes-row"
                  >
                    <td colspan="23">
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
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPeriodItems, getPeriodSizes } from '../api/economics'
import PeriodFilter from '../components/PeriodFilter.vue'
import type { EconomicsItem, EconomicsSizeItem, EconomicsTotals } from '../types/economics'

const route = useRoute()
const router = useRouter()

const items = ref<EconomicsItem[]>([])
const totals = ref<EconomicsTotals | null>(null)
const loading = ref(false)
const error = ref('')
const expandedItemKeys = ref<string[]>([])
const sizesByItem = ref<Record<string, EconomicsSizeItem[]>>({})
const sizesLoadingByItem = ref<Record<string, boolean>>({})
const sizesErrorByItem = ref<Record<string, string>>({})

const form = reactive({
  date_from: '',
  date_to: '',
})

const accountId = computed(() => {
  const value = route.query.account_id
  return typeof value === 'string' && value.length > 0 ? value : ''
})

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultDates() {
  const today = new Date()
  const dateTo = toDateInputValue(today)

  const dateFromValue = new Date(today)
  dateFromValue.setDate(today.getDate() - 30)

  return {
    date_from: toDateInputValue(dateFromValue),
    date_to: dateTo,
  }
}

function normalizeDateValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function syncFormFromQuery() {
  const defaults = getDefaultDates()
  form.date_from = normalizeDateValue(route.query.date_from, defaults.date_from)
  form.date_to = normalizeDateValue(route.query.date_to, defaults.date_to)
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  return `${formatNumber(value)}%`
}

function getItemKey(item: EconomicsItem): string {
  return `${item.vendor_code || 'empty'}-${item.nm_id || 'empty'}`
}

function canExpandItem(item: EconomicsItem): boolean {
  return item.nm_id !== null && item.vendor_code !== null && item.vendor_code.length > 0
}

function isExpanded(item: EconomicsItem): boolean {
  return expandedItemKeys.value.includes(getItemKey(item))
}

async function loadSizes(item: EconomicsItem) {
  if (!accountId.value || item.nm_id === null || !item.vendor_code) {
    return
  }

  const itemKey = getItemKey(item)
  if (sizesByItem.value[itemKey]) {
    return
  }

  sizesLoadingByItem.value[itemKey] = true
  sizesErrorByItem.value[itemKey] = ''

  try {
    const sizes = await getPeriodSizes({
      account_id: accountId.value,
      date_from: form.date_from,
      date_to: form.date_to,
      nm_id: item.nm_id,
      vendor_code: item.vendor_code,
    })

    sizesByItem.value[itemKey] = sizes
  } catch (err) {
    sizesErrorByItem.value[itemKey] =
      err instanceof Error ? err.message : 'Не удалось загрузить размеры.'
  } finally {
    sizesLoadingByItem.value[itemKey] = false
  }
}

async function toggleItem(item: EconomicsItem) {
  if (!canExpandItem(item)) {
    return
  }

  const itemKey = getItemKey(item)
  if (expandedItemKeys.value.includes(itemKey)) {
    expandedItemKeys.value = expandedItemKeys.value.filter((key) => key !== itemKey)
    return
  }

  expandedItemKeys.value = [...expandedItemKeys.value, itemKey]
  await loadSizes(item)
}

async function loadItems() {
  if (!accountId.value) {
    items.value = []
    totals.value = null
    expandedItemKeys.value = []
    sizesByItem.value = {}
    sizesLoadingByItem.value = {}
    sizesErrorByItem.value = {}
    return
  }

  loading.value = true
  error.value = ''
  expandedItemKeys.value = []
  sizesByItem.value = {}
  sizesLoadingByItem.value = {}
  sizesErrorByItem.value = {}

  try {
    const response = await getPeriodItems({
      account_id: accountId.value,
      date_from: form.date_from,
      date_to: form.date_to,
    })

    items.value = response.items ?? []
    totals.value = response.totals ?? null
  } catch (err) {
    items.value = []
    totals.value = null
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить данные.'
  } finally {
    loading.value = false
  }
}

async function handlePeriodApply(period: { date_from: string; date_to: string }) {
  if (!accountId.value) {
    return
  }

  await router.push({
    path: '/economics',
    query: {
      account_id: accountId.value,
      date_from: period.date_from,
      date_to: period.date_to,
    },
  })
}

watch(
  () => route.query,
  async () => {
    syncFormFromQuery()
    await loadItems()
  },
  { immediate: true },
)
</script>














