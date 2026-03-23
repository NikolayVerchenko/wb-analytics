<template>
  <div class="table-header-bar">
    <h3 class="table-header-title">{{ title }}</h3>

    <div class="table-header-actions">
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
