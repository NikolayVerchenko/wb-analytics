import type { Ref } from 'vue'
import type { ProductAggregate } from '../../types/analytics'
import { useProductFilter, type ProductFilterState } from './useProductFilter'

/**
 * Composable для фильтрации данных таблицы "Сводка"
 * Отвечает только за фильтрацию, не содержит бизнес-логику агрегации
 */
export function useSummaryFilter(
  source: Ref<ProductAggregate[]>
): ProductFilterState {
  return useProductFilter(source)
}
