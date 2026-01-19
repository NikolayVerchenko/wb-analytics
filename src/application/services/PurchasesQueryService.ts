import type { PurchaseListRow, PurchasesQueryParams } from '../../types/purchases'

/**
 * Сервис для фильтрации, поиска и сортировки списка закупок
 * Чистая логика без зависимости от UI
 */
export class PurchasesQueryService {
  /**
   * Фильтрует и сортирует список закупок согласно параметрам запроса
   */
  query(purchases: PurchaseListRow[], params: PurchasesQueryParams): PurchaseListRow[] {
    let result = [...purchases]

    // Поиск
    if (params.search && params.search.trim()) {
      const searchLower = params.search.toLowerCase().trim()
      result = result.filter(purchase => {
        // Поиск по номеру заказа
        if (purchase.orderNumber.toLowerCase().includes(searchLower)) {
          return true
        }
        // Можно добавить поиск по другим полям при необходимости
        return false
      })
    }

    // Фильтр по статусу
    if (params.status && params.status !== 'all') {
      result = result.filter(purchase => purchase.status === params.status)
    }

    // Сортировка
    const sortBy = params.sortBy || 'date'
    const sortOrder = params.sortOrder || 'desc'

    result.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'totalRUB':
          comparison = a.totalRUB - b.totalRUB
          break
        default:
          comparison = 0
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }
}
