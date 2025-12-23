import { defineStore } from 'pinia'
import { ref } from 'vue'
import { container } from '@core/di/container'
import type { DateRange } from '@core/services/DateRangeService'

export const useFilterStore = defineStore('filter', () => {
  const dateRangeService = container.getDateRangeService()
  
  // State
  const currentDateRange = ref<DateRange>(dateRangeService.getLast30Days())
  const selectedCategories = ref<string[] | undefined>(undefined)
  const selectedVendorCodes = ref<string[] | undefined>(undefined)

  // Actions
  function setDateRange(range: DateRange): void {
    currentDateRange.value = range
  }

  function setSelectedCategories(categories: string[] | undefined): void {
    selectedCategories.value = categories
  }

  function setSelectedVendorCodes(vendorCodes: string[] | undefined): void {
    selectedVendorCodes.value = vendorCodes
  }

  return {
    currentDateRange,
    selectedCategories,
    selectedVendorCodes,
    dateRangeService,
    setDateRange,
    setSelectedCategories,
    setSelectedVendorCodes
  }
})


