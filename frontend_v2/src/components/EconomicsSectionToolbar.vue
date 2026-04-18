<template>
  <div class="section-toolbar">
    <div class="section-toolbar-title">
      <h3 class="section-title">{{ title }}</h3>
    </div>

    <div class="section-toolbar-actions section-toolbar-actions-compact">
      <PeriodFilter
        :date-from="dateFrom"
        :date-to="dateTo"
        @apply="emit('period-apply', $event)"
      />

      <EconomicsFilters
        :account-id="accountId"
        :date-from="dateFrom"
        :date-to="dateTo"
        :value="filters"
        @apply="emit('filters-apply', $event)"
        @reset="emit('filters-reset')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import EconomicsFilters from './EconomicsFilters.vue'
import PeriodFilter from './PeriodFilter.vue'
import type { EconomicsFiltersValue } from '../types/filters'

defineProps<{
  title: string
  accountId: string
  dateFrom: string
  dateTo: string
  filters: EconomicsFiltersValue
}>()

const emit = defineEmits<{
  'period-apply': [{ date_from: string; date_to: string }]
  'filters-apply': [EconomicsFiltersValue]
  'filters-reset': []
}>()
</script>

<style scoped>
.section-toolbar-actions-compact {
  gap: 8px;
}
</style>
