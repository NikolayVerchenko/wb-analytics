import type { Ref } from 'vue'
import type { ProductAggregate } from '../../types/analytics'
import { useProductFilter, type ProductFilterState } from './useProductFilter'

/**
 * Composable для фильтрации данных дашборда.
 * Отдельное состояние от "Сводки".
 */
export function useDashboardFilter(source: Ref<ProductAggregate[]>): ProductFilterState {
  return useProductFilter(source)
}
