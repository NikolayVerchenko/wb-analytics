/**
 * DTO для отображения закупки в таблице листинга
 */
export interface PurchaseListRow {
  id: number
  date: string
  orderNumber: string
  status: string
  itemsCount: number // уникальных товаров (по nmID)
  totalQuantity: number // sum(quantity)
  totalRUB: number // итоговая сумма в рублях
}

/**
 * Параметры запроса для фильтрации/сортировки списка закупок
 */
export interface PurchasesQueryParams {
  search?: string // поиск по номеру/артикулу/названию
  status?: string // фильтр по статусу
  sortBy?: 'date' | 'totalRUB' // поле сортировки
  sortOrder?: 'asc' | 'desc' // направление сортировки
}
