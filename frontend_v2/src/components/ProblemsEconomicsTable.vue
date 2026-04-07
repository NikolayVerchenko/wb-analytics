<template>
  <div class="card stack">
    <slot name="header">
      <h3 class="section-title">Проблемные товары</h3>
    </slot>

    <div class="table-wrapper problems-table-wrapper">
      <table class="problems-table">
        <thead>
          <tr>
            <th>Фото</th>
            <th>Артикул</th>
            <th class="numeric">Продажи</th>
            <th class="numeric">Перечисления</th>
            <th class="numeric">Прибыль</th>
            <th class="numeric">Маржа %</th>
            <th class="numeric">ROI %</th>
            <th class="numeric">Реклама</th>
            <th class="numeric">Логистика</th>
            <th class="numeric">% выкупа</th>
            <th>Статус</th>
            <th>Причина</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="getRowKey(row)" :class="['problems-row', `status-${row.status}`]">
            <td class="photo-cell">
              <img v-if="row.photo_url" :src="row.photo_url" :alt="row.vendor_code || 'Товар'" class="product-photo" />
              <span v-else>-</span>
            </td>
            <td>
              <div class="article-cell">
                <span class="article-main">{{ row.vendor_code || '-' }}</span>
                <span class="article-sub">{{ formatNumber(row.nm_id) }}</span>
              </div>
            </td>
            <td class="numeric">{{ formatNumber(row.sales_quantity) }}</td>
            <td class="numeric">{{ formatNumber(row.seller_transfer) }}</td>
            <td :class="['numeric', getProfitClass(row.status)]">{{ formatNumber(row.profit_amount) }}</td>
            <td :class="['numeric', getProfitClass(row.status)]">{{ formatPercent(row.margin_percent) }}</td>
            <td :class="['numeric', getProfitClass(row.status)]">{{ formatPercent(row.roi_percent) }}</td>
            <td class="numeric">{{ formatNumber(row.advert_cost) }}</td>
            <td class="numeric">{{ formatNumber(row.delivery_cost) }}</td>
            <td class="numeric">{{ formatPercent(row.buyout_percent) }}</td>
            <td>
              <span :class="['status-pill', `status-pill-${row.status}`]">{{ statusLabel(row.status) }}</span>
            </td>
            <td>
              <span class="problem-label">{{ row.mainProblem }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProblemEconomicsRow, ProblemEconomicsStatus } from '../composables/useProblemsEconomicsDiagnostics'
import { formatNumber, formatPercent } from '../utils/format'

defineProps<{
  rows: ProblemEconomicsRow[]
}>()

function getRowKey(row: ProblemEconomicsRow) {
  return `${row.vendor_code || 'empty'}-${row.nm_id || 'empty'}`
}

function statusLabel(status: ProblemEconomicsStatus) {
  if (status === 'profit') {
    return 'Прибыль'
  }
  if (status === 'risk') {
    return 'Риск'
  }
  return 'Убыток'
}

function getProfitClass(status: ProblemEconomicsStatus) {
  if (status === 'profit') {
    return 'metric-positive'
  }
  if (status === 'risk') {
    return 'metric-warning'
  }
  return 'metric-negative'
}
</script>

<style scoped>
.problems-table {
  width: 100%;
  min-width: 1160px;
  border-collapse: separate;
  border-spacing: 0;
}

.problems-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 14px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
}

.problems-table tbody td {
  padding: 14px 12px;
  border-bottom: 1px solid #eef2f7;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
}

.problems-row:hover td {
  background: #f8fafc;
}

.problems-row.status-loss td:first-child,
.problems-row.status-risk td:first-child,
.problems-row.status-profit td:first-child {
  box-shadow: inset 3px 0 0 transparent;
}

.problems-row.status-loss td:first-child {
  box-shadow: inset 3px 0 0 #ef4444;
}

.problems-row.status-risk td:first-child {
  box-shadow: inset 3px 0 0 #f59e0b;
}

.problems-row.status-profit td:first-child {
  box-shadow: inset 3px 0 0 #22c55e;
}

.photo-cell {
  width: 68px;
}

.numeric {
  text-align: right;
  white-space: nowrap;
}

.article-cell {
  display: grid;
  gap: 2px;
}

.article-main {
  font-weight: 700;
  color: #111827;
}

.article-sub {
  font-size: 12px;
  color: #6b7280;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 76px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-pill-profit {
  background: #dcfce7;
  color: #166534;
}

.status-pill-risk {
  background: #fef3c7;
  color: #92400e;
}

.status-pill-loss {
  background: #fee2e2;
  color: #991b1b;
}

.metric-positive {
  color: #166534;
  font-weight: 700;
}

.metric-warning {
  color: #92400e;
  font-weight: 700;
}

.metric-negative {
  color: #b91c1c;
  font-weight: 700;
}

.problem-label {
  color: #374151;
  font-weight: 600;
}
</style>
