<template>
  <div class="card stack">
    <slot name="header">
      <h3>Дашборд</h3>
    </slot>

    <div class="dashboard-grid">
      <article v-for="metric in metrics" :key="metric.key" class="dashboard-card">
        <span class="dashboard-label">{{ metric.label }}</span>
        <strong class="dashboard-value">{{ metric.value }}</strong>
        <span v-if="metric.previous" class="dashboard-meta">Было: {{ metric.previous }}</span>
        <span v-if="metric.delta" class="dashboard-delta">Изменение: {{ metric.delta }}</span>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardMetricView } from '../types/dashboard'

defineProps<{
  metrics: DashboardMetricView[]
}>()
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.dashboard-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f9fafb);
}

.dashboard-label {
  font-size: 13px;
  color: #6b7280;
}

.dashboard-value {
  font-size: 24px;
  line-height: 1.1;
  color: #111827;
}

.dashboard-meta,
.dashboard-delta {
  font-size: 12px;
  color: #6b7280;
}

@media (max-width: 960px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
