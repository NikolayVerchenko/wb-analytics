<template>
  <div :class="embedded ? 'dashboard-panel' : 'card dashboard-panel'">
    <slot name="header">
      <h3 v-if="!embedded" class="section-title">Дашборд</h3>
    </slot>

    <div class="dashboard-group">
      <div class="dashboard-group-header">
        <h4 class="dashboard-group-title">Главные KPI</h4>
        <span class="dashboard-group-hint">Ключевые показатели бизнеса за период.</span>
      </div>
      <div class="dashboard-grid dashboard-grid-primary">
        <article
          v-for="card in primaryCards"
          :key="card.key"
          :class="['dashboard-card', 'dashboard-card-primary', `kpi-${card.state}`]"
        >
          <div class="dashboard-card-head">
            <span class="dashboard-label">{{ card.label }}</span>
            <span class="kpi-badge" :data-state="card.state">{{ statusLabel(card.state) }}</span>
          </div>
          <strong class="dashboard-value">{{ card.value }}</strong>
          <span v-if="card.hint" class="dashboard-hint">{{ card.hint }}</span>
          <div class="dashboard-meta">
            <span v-if="card.previous">Было: {{ card.previous }}</span>
            <span v-if="card.delta" class="dashboard-delta" :data-trend="card.trend">
              <span class="delta-icon">{{ trendArrow(card.trend) }}</span>
              <span>{{ card.delta }}</span>
            </span>
          </div>
        </article>
      </div>
    </div>

    <div class="dashboard-group">
      <div class="dashboard-group-header">
        <h4 class="dashboard-group-title">Операционные KPI</h4>
        <span class="dashboard-group-hint">Показатели операционной эффективности.</span>
      </div>
      <div class="dashboard-grid dashboard-grid-secondary">
        <article
          v-for="card in secondaryCards"
          :key="card.key"
          :class="['dashboard-card', 'dashboard-card-secondary', `kpi-${card.state}`]"
        >
          <div class="dashboard-card-head">
            <span class="dashboard-label">{{ card.label }}</span>
            <span class="kpi-dot" :data-state="card.state"></span>
          </div>
          <strong class="dashboard-value">{{ card.value }}</strong>
          <span v-if="card.secondaryValue" class="dashboard-secondary-value">
            {{ card.secondaryLabel || 'Дополнительно' }}: {{ card.secondaryValue }}
          </span>
          <span v-if="card.hint" class="dashboard-hint">{{ card.hint }}</span>
          <div class="dashboard-meta">
            <span v-if="card.previous">Было: {{ card.previous }}</span>
            <span v-if="card.delta" class="dashboard-delta" :data-trend="card.trend">
              <span class="delta-icon">{{ trendArrow(card.trend) }}</span>
              <span>{{ card.delta }}</span>
            </span>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardMetricView } from '../types/dashboard'

const props = withDefaults(
  defineProps<{
    metrics: DashboardMetricView[]
    /** Родитель уже даёт обёртку `.card.dashboard-panel`. */
    embedded?: boolean
  }>(),
  { embedded: false },
)

type CardState = 'positive' | 'warning' | 'negative' | 'neutral'

type CardView = DashboardMetricView & {
  state: CardState
  trend: 'up' | 'down' | 'flat'
  secondaryValue?: string
  secondaryLabel?: string
}

const primaryKeys = new Set(['realization_before_spp', 'realization_after_spp', 'profit_amount'])
const secondaryOrder = [
  'sales_quantity',
  'delivery_quantity',
  'refusal_quantity',
  'buyout_percent',
  'wb_commission_amount',
  'delivery_cost',
  'paid_storage_cost',
]

const positiveKeys = new Set([
  'sales_quantity',
  'order_count',
  'order_sum',
  'delivery_quantity',
  'buyout_percent',
  'seller_transfer',
  'realization_before_spp',
  'realization_after_spp',
  'profit_amount',
  'margin_percent',
  'roi_percent',
])

const negativeKeys = new Set([
  'wb_commission_amount',
  'wb_commission_percent',
  'delivery_cost',
  'paid_storage_cost',
  'penalty_cost',
  'advert_cost',
  'tax_amount',
  'spp_amount',
  'spp_percent',
  'refusal_quantity',
  'return_quantity',
])

function parseDelta(value?: string): number | null {
  if (!value) {
    return null
  }
  const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.+-]/g, '')
  if (!cleaned) {
    return null
  }
  const numeric = Number(cleaned)
  return Number.isNaN(numeric) ? null : numeric
}

function isPercentMetric(key: string, delta?: string) {
  if (key.endsWith('_percent')) {
    return true
  }
  return Boolean(delta && delta.includes('%'))
}

function getTrend(deltaValue: number | null, threshold: number): 'up' | 'down' | 'flat' {
  if (deltaValue === null || Math.abs(deltaValue) < threshold) {
    return 'flat'
  }
  return deltaValue > 0 ? 'up' : 'down'
}

function getState(metric: DashboardMetricView): CardState {
  const deltaValue = parseDelta(metric.delta)
  const isPositiveMetric = positiveKeys.has(metric.key)
  const isNegativeMetric = negativeKeys.has(metric.key)
  const threshold = isPercentMetric(metric.key, metric.delta) ? 0.1 : 1

  if (deltaValue === null || Math.abs(deltaValue) < threshold) {
    return 'neutral'
  }

  const signed = isNegativeMetric ? -deltaValue : deltaValue

  if (signed > 0) {
    return 'positive'
  }

  if (Math.abs(deltaValue) < threshold * 5) {
    return 'warning'
  }

  return 'negative'
}

function getCardView(metric: DashboardMetricView): CardView {
  const threshold = isPercentMetric(metric.key, metric.delta) ? 0.1 : 1
  const deltaValue = parseDelta(metric.delta)
  return {
    ...metric,
    state: getState(metric),
    trend: getTrend(deltaValue, threshold),
  }
}

const primaryCards = computed(() => props.metrics.filter((metric) => primaryKeys.has(metric.key)).map(getCardView))

const secondaryCards = computed(() => {
  const rest = props.metrics.filter((metric) => !primaryKeys.has(metric.key))
  const byKey = new Map(rest.map((metric) => [metric.key, metric]))
  const ordered: DashboardMetricView[] = []

  const orderAmountMetric = props.metrics.find((metric) => metric.key === 'order_sum')
  const orderCountMetric = props.metrics.find((metric) => metric.key === 'order_count')
  const cards: CardView[] = []

  if (orderAmountMetric || orderCountMetric) {
    if (orderAmountMetric) {
      byKey.delete(orderAmountMetric.key)
    }
    if (orderCountMetric) {
      byKey.delete(orderCountMetric.key)
    }
    const base = getCardView(
      orderAmountMetric ?? {
        key: 'orders_summary',
        label: 'Заказы',
        value: orderCountMetric?.value ?? '—',
        previous: orderCountMetric?.previous,
        delta: orderCountMetric?.delta,
        hint: orderCountMetric?.hint,
      },
    )
    cards.push({
      ...base,
      key: 'orders_summary',
      label: 'Заказы',
      value: orderAmountMetric?.value ?? '—',
      secondaryValue: orderCountMetric?.value ?? '—',
      secondaryLabel: 'Количество заказов',
    })
  }

  for (const key of secondaryOrder) {
    const metric = byKey.get(key)
    if (metric) {
      ordered.push(metric)
      byKey.delete(key)
    }
  }
  return cards.concat(ordered.concat(Array.from(byKey.values())).map(getCardView))
})

function trendArrow(trend: 'up' | 'down' | 'flat') {
  if (trend === 'up') {
    return '↑'
  }
  if (trend === 'down') {
    return '↓'
  }
  return '→'
}

function statusLabel(state: CardState) {
  if (state === 'positive') return 'Рост'
  if (state === 'negative') return 'Падение'
  if (state === 'warning') return 'Риск'
  return 'Стабильно'
}
</script>

<style scoped>
.dashboard-panel {
  display: grid;
  gap: 24px;
}

.dashboard-group {
  display: grid;
  gap: 14px;
}

.dashboard-group-header {
  display: grid;
  gap: 4px;
}

.dashboard-group-title {
  margin: 0;
  font-size: 16px;
  color: #111827;
}

.dashboard-group-hint {
  font-size: 12px;
  color: #9ca3af;
}

.dashboard-grid {
  display: grid;
  gap: 16px;
}

.dashboard-grid-primary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-grid-secondary {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.dashboard-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
  overflow: hidden;
}

.dashboard-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
}

.dashboard-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.dashboard-card-primary {
  min-height: 160px;
  padding: 22px;
}

.dashboard-card-secondary {
  min-height: 110px;
  padding: 14px;
  background: #f9fafb;
}

.dashboard-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dashboard-label {
  font-size: 13px;
  color: #6b7280;
}

.dashboard-value {
  font-size: 28px;
  line-height: 1.15;
  color: #111827;
}

.dashboard-card-secondary .dashboard-value {
  font-size: 20px;
}

.dashboard-secondary-value {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.dashboard-hint {
  font-size: 12px;
  color: #6b7280;
}

.dashboard-meta {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.dashboard-delta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.delta-icon {
  font-size: 12px;
}

.kpi-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #f3f4f6;
  color: #6b7280;
}

.kpi-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d1d5db;
}

.kpi-positive::before {
  background: #22c55e;
}

.kpi-negative::before {
  background: #ef4444;
}

.kpi-warning::before {
  background: #f59e0b;
}

.kpi-neutral::before {
  background: #e5e7eb;
}

.kpi-positive .kpi-badge,
.kpi-positive .kpi-dot {
  background: #dcfce7;
  color: #166534;
}

.kpi-negative .kpi-badge,
.kpi-negative .kpi-dot {
  background: #fee2e2;
  color: #991b1b;
}

.kpi-warning .kpi-badge,
.kpi-warning .kpi-dot {
  background: #fef3c7;
  color: #92400e;
}

.kpi-neutral .kpi-badge,
.kpi-neutral .kpi-dot {
  background: #f3f4f6;
  color: #6b7280;
}

.dashboard-delta[data-trend='up'] {
  color: #15803d;
}

.dashboard-delta[data-trend='down'] {
  color: #b91c1c;
}

.dashboard-delta[data-trend='flat'] {
  color: #6b7280;
}

@media (max-width: 1200px) {
  .dashboard-grid-secondary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .dashboard-grid-primary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid-secondary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-grid-primary,
  .dashboard-grid-secondary {
    grid-template-columns: 1fr;
  }

  .dashboard-card-primary,
  .dashboard-card-secondary {
    min-height: 120px;
  }
}
</style>
