/**
 * Распределенные рекламные расходы по артикулам
 * Хранит уже распределенные затраты в разрезе: артикул + дата + кампания
 */
export interface ProductAdExpense {
  id?: number
  nmId: number // Артикул (nm_id)
  date: string // Дата затрат (ISO string, формат YYYY-MM-DD)
  sum: number // Сумма затрат, распределенная на этот артикул
  advertId: number // ID рекламной кампании
  createdAt?: string // Дата создания записи
  updatedAt?: string // Дата обновления записи
}

