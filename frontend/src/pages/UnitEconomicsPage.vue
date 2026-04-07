<script setup lang="ts">
import UnitEconomicsTable from '../features/unit-economics-table/ui/UnitEconomicsTable.vue'
import { useEconomicsPeriod } from '../entities/economics/model/useEconomicsPeriod'

const {
  items,
  totals,
  sizeItems,
  sizeErrors,
  expandedKeys,
  loadingSizeKeys,
  isLoading,
  errorMessage,
  dateFrom,
  dateTo,
  selectedAccountName,
  toggleSizes,
  setDateRange,
} = useEconomicsPeriod()

const onApplyRange = (payload: { dateFrom: string; dateTo: string }) => {
  void setDateRange(payload.dateFrom, payload.dateTo)
}
</script>

<template>
  <UnitEconomicsTable
    :items="items"
    :totals="totals"
    :size-items="sizeItems"
    :expanded-keys="expandedKeys"
    :loading-size-keys="loadingSizeKeys"
    :size-errors="sizeErrors"
    :date-from="dateFrom"
    :date-to="dateTo"
    :selected-account-name="selectedAccountName"
    :is-loading="isLoading"
    :error-message="errorMessage"
    :can-load="Boolean(selectedAccountName)"
    @toggle-sizes="toggleSizes"
    @apply-range="onApplyRange"
  />
</template>
