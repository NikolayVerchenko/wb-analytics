import { ref, computed, type Ref } from 'vue'
import type { IPurchase, IPurchaseItem } from '../types/db'
import type { GroupedPurchase } from '../core/domain/purchases/types'

/**
 * Composable для UI логики закупок: фильтрация, валидация
 */
export function usePurchaseUI(
  formData: Ref<Omit<IPurchase, 'id'>>,
  groupedProducts: Ref<GroupedPurchase[]>
) {
  const searchQuery = ref('')

  // Фильтрация групп по поисковому запросу
  const filteredGroups = computed(() => {
    if (!searchQuery.value.trim()) {
      return groupedProducts.value
    }

    const query = searchQuery.value.toLowerCase().trim()

    return groupedProducts.value.filter((group) => {
      const titleMatch = group.title?.toLowerCase().includes(query)
      const nmIDMatch = group.nmID.toString().includes(query)
      const vendorMatch = group.vendorCode?.toLowerCase().includes(query)

      return titleMatch || nmIDMatch || vendorMatch
    })
  })

  // Валидация: критичные ошибки (нельзя сохранить)
  const validationErrors = computed(() => {
    const errors: {
      form?: string[]
      groups?: Record<number, string[]>
    } = {
      form: [],
      groups: {},
    }

    // Ошибки формы
    if (!formData.value.date) {
      errors.form!.push('Дата закупки обязательна')
    }
    if (!formData.value.orderNumber?.trim()) {
      errors.form!.push('Номер заказа обязателен')
    }
    if (formData.value.items.length === 0) {
      errors.form!.push('Добавьте хотя бы один товар')
    }

    // Ошибки в товарах
    for (const item of formData.value.items) {
      if (item.quantity <= 0) {
        if (!errors.groups![item.nmID]) {
          errors.groups![item.nmID] = []
        }
        errors.groups![item.nmID].push(`Размер ${item.techSize}: количество должно быть больше 0`)
      }
    }

    return errors
  })

  // Валидация: предупреждения (можно сохранить, но подсветить)
  const validationWarnings = computed(() => {
    const warnings: {
      form?: string[]
      groups?: Record<number, string[]>
    } = {
      form: [],
      groups: {},
    }

    // Предупреждения формы
    if (formData.value.exchangeRate <= 0 && hasCNYFields()) {
      warnings.form!.push('Курс CNY/RUB не задан или равен 0')
    }

    const totalQuantity = formData.value.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    if (formData.value.logisticsToMoscow > 0 && totalQuantity === 0) {
      warnings.form!.push('Логистика до МСК задана, но товаров нет (деление на 0)')
    }

    // Предупреждения в группах
    for (const group of groupedProducts.value) {
      const groupWarnings: string[] = []

      // Проверка веса
      const hasWeight = group.items.some((item) => item.weightPerUnit && item.weightPerUnit > 0)
      if (!hasWeight) {
        groupWarnings.push('Не указан вес единицы товара')
      }

      // Проверка цены
      const hasPrice = group.items.some((item) => item.priceCNY > 0)
      if (!hasPrice && group.totalQuantity > 0) {
        groupWarnings.push('Цена CNY равна 0')
      }

      if (groupWarnings.length > 0) {
        warnings.groups![group.nmID] = groupWarnings
      }
    }

    return warnings
  })

  // Состояние валидации для каждой группы
  const validationState = computed(() => {
    const state: Record<
      number,
      {
        errors: string[]
        warnings: string[]
      }
    > = {}

    for (const group of groupedProducts.value) {
      state[group.nmID] = {
        errors: validationErrors.value.groups?.[group.nmID] || [],
        warnings: validationWarnings.value.groups?.[group.nmID] || [],
      }
    }

    return state
  })

  // Проверка наличия полей в CNY для предупреждения о курсе
  function hasCNYFields(): boolean {
    return formData.value.items.some((item) => item.priceCNY > 0 || item.logisticsCNY > 0)
  }

  // Критичные ошибки есть
  const hasCriticalErrors = computed(() => {
    return (
      validationErrors.value.form!.length > 0 ||
      Object.keys(validationErrors.value.groups || {}).length > 0
    )
  })

  return {
    searchQuery,
    filteredGroups,
    validationErrors,
    validationWarnings,
    validationState,
    hasCriticalErrors,
  }
}

