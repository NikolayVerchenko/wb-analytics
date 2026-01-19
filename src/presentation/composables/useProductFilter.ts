import { ref, computed, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import type { ProductAggregate } from '../../types/analytics'

export interface ProductFilterState {
  searchQuery: Ref<string>
  debouncedQuery: Ref<string>
  selectedVendorCodes: Ref<string[]>
  selectedSubjects: Ref<string[]>
  selectedBrands: Ref<string[]>
  includeNoBrand: Ref<boolean>
  setSelectedVendorCodes: (codes: string[]) => void
  toggleVendorCode: (code: string) => void
  clearSelectedVendorCodes: () => void
  setSelectedSubjects: (subjects: string[]) => void
  toggleSubject: (subject: string) => void
  clearSelectedSubjects: () => void
  setSelectedBrands: (brands: string[]) => void
  toggleBrand: (brand: string) => void
  clearSelectedBrands: () => void
  setIncludeNoBrand: (value: boolean) => void
  filteredRows: ComputedRef<ProductAggregate[]>
}

export interface ProductFilterCriteria {
  selectedVendorCodes: string[]
  selectedSubjects: string[]
  selectedBrands: string[]
  includeNoBrand: boolean
  query: string
}

export function filterProducts(
  rows: ProductAggregate[],
  criteria: ProductFilterCriteria
): ProductAggregate[] {
  let base = rows

  if (criteria.selectedVendorCodes.length > 0) {
    const selectedSet = new Set(criteria.selectedVendorCodes)
    base = base.filter((product) => {
      return product.sa && selectedSet.has(product.sa)
    })
  }

  if (criteria.selectedSubjects.length > 0) {
    const selectedSet = new Set(criteria.selectedSubjects)
    base = base.filter((product) => {
      return product.sj && selectedSet.has(product.sj)
    })
  }

  if (criteria.selectedBrands.length > 0 || criteria.includeNoBrand) {
    const selectedSet = new Set(criteria.selectedBrands)
    base = base.filter((product) => {
      const hasBrand = !!product.bc
      const matchesBrand = hasBrand && selectedSet.has(product.bc)
      const matchesNoBrand = criteria.includeNoBrand && !hasBrand
      return matchesBrand || matchesNoBrand
    })
  }

  const query = criteria.query.trim().toLowerCase()
  if (query) {
    base = base.filter((product) => {
      const niMatch = String(product.ni).includes(query)
      const saMatch = product.sa?.toLowerCase().includes(query) ?? false
      const titleMatch = product.title?.toLowerCase().includes(query) ?? false
      const subjectMatch = product.sj?.toLowerCase().includes(query) ?? false
      const brandMatch = product.bc?.toLowerCase().includes(query) ?? false

      return niMatch || saMatch || titleMatch || subjectMatch || brandMatch
    })
  }

  return base
}

export function useProductFilter(source: Ref<ProductAggregate[]>): ProductFilterState {
  const searchQuery = ref<string>('')
  const debouncedQuery = ref<string>('')
  const selectedVendorCodes = ref<string[]>([])
  const selectedSubjects = ref<string[]>([])
  const selectedBrands = ref<string[]>([])
  const includeNoBrand = ref<boolean>(false)

  let timer: number | null = null

  watch(
    searchQuery,
    (newQuery) => {
      if (timer) {
        clearTimeout(timer)
      }
      timer = window.setTimeout(() => {
        debouncedQuery.value = newQuery
      }, 300)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })

  const setSelectedVendorCodes = (codes: string[]) => {
    selectedVendorCodes.value = [...codes]
  }

  const toggleVendorCode = (code: string) => {
    const index = selectedVendorCodes.value.indexOf(code)
    if (index > -1) {
      selectedVendorCodes.value = selectedVendorCodes.value.filter((c) => c !== code)
    } else {
      selectedVendorCodes.value = [...selectedVendorCodes.value, code]
    }
  }

  const clearSelectedVendorCodes = () => {
    selectedVendorCodes.value = []
  }

  const setSelectedSubjects = (subjects: string[]) => {
    selectedSubjects.value = [...subjects]
  }

  const toggleSubject = (subject: string) => {
    const index = selectedSubjects.value.indexOf(subject)
    if (index > -1) {
      selectedSubjects.value = selectedSubjects.value.filter((s) => s !== subject)
    } else {
      selectedSubjects.value = [...selectedSubjects.value, subject]
    }
  }

  const clearSelectedSubjects = () => {
    selectedSubjects.value = []
  }

  const setSelectedBrands = (brands: string[]) => {
    selectedBrands.value = [...brands]
  }

  const toggleBrand = (brand: string) => {
    const index = selectedBrands.value.indexOf(brand)
    if (index > -1) {
      selectedBrands.value = selectedBrands.value.filter((b) => b !== brand)
    } else {
      selectedBrands.value = [...selectedBrands.value, brand]
    }
  }

  const clearSelectedBrands = () => {
    selectedBrands.value = []
  }

  const setIncludeNoBrand = (value: boolean) => {
    includeNoBrand.value = value
  }

  const filteredRows = computed(() => {
    return filterProducts(source.value, {
      selectedVendorCodes: selectedVendorCodes.value,
      selectedSubjects: selectedSubjects.value,
      selectedBrands: selectedBrands.value,
      includeNoBrand: includeNoBrand.value,
      query: debouncedQuery.value,
    })
  })

  return {
    searchQuery,
    debouncedQuery,
    selectedVendorCodes,
    selectedSubjects,
    selectedBrands,
    includeNoBrand,
    setSelectedVendorCodes,
    toggleVendorCode,
    clearSelectedVendorCodes,
    setSelectedSubjects,
    toggleSubject,
    clearSelectedSubjects,
    setSelectedBrands,
    toggleBrand,
    clearSelectedBrands,
    setIncludeNoBrand,
    filteredRows,
  }
}
