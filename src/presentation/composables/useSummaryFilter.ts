import { ref, computed, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import type { ProductAggregate } from '../../types/analytics'

/**
 * Composable для фильтрации данных таблицы "Сводка"
 * Отвечает только за фильтрацию, не содержит бизнес-логику агрегации
 */
export function useSummaryFilter(
  source: Ref<ProductAggregate[]>
): {
  searchQuery: Ref<string>
  selectedVendorCodes: Ref<string[]>
  selectedSubjects: Ref<string[]>
  setSelectedVendorCodes: (codes: string[]) => void
  toggleVendorCode: (code: string) => void
  clearSelectedVendorCodes: () => void
  setSelectedSubjects: (subjects: string[]) => void
  toggleSubject: (subject: string) => void
  clearSelectedSubjects: () => void
  filteredRows: ComputedRef<ProductAggregate[]>
} {
  const searchQuery = ref<string>('')
  const debouncedQuery = ref<string>('')
  const selectedVendorCodes = ref<string[]>([])
  const selectedSubjects = ref<string[]>([])

  let timer: number | null = null

  // Debounce поискового запроса (300ms)
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

  // Очистка таймера при размонтировании
  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })

  // Управление выбранными vendorCode
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

  // Фильтрация данных
  const filteredRows = computed(() => {
    let base = source.value

    // Фильтрация по выбранным vendorCode
    if (selectedVendorCodes.value.length > 0) {
      const selectedSet = new Set(selectedVendorCodes.value)
      base = base.filter((product) => {
        return product.sa && selectedSet.has(product.sa)
      })
    }

    if (selectedSubjects.value.length > 0) {
      const selectedSet = new Set(selectedSubjects.value)
      base = base.filter((product) => {
        return product.sj && selectedSet.has(product.sj)
      })
    }

    // Фильтрация по поисковому запросу
    const query = debouncedQuery.value.trim().toLowerCase()
    if (query) {
      base = base.filter((product) => {
        // Поиск по nmID (ni) - преобразуем в строку
        const niMatch = String(product.ni).includes(query)

        // Поиск по vendorCode (sa) - регистронезависимый
        const saMatch = product.sa?.toLowerCase().includes(query) ?? false

        // Поиск по title - регистронезависимый
        const titleMatch = product.title?.toLowerCase().includes(query) ?? false

        const subjectMatch = product.sj?.toLowerCase().includes(query) ?? false

        return niMatch || saMatch || titleMatch || subjectMatch
      })
    }

    return base
  })

  return {
    searchQuery,
    selectedVendorCodes,
    selectedSubjects,
    setSelectedVendorCodes,
    toggleVendorCode,
    clearSelectedVendorCodes,
    setSelectedSubjects,
    toggleSubject,
    clearSelectedSubjects,
    filteredRows,
  }
}
