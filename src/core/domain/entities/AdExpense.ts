/**
 * Рекламные расходы по артикулам
 * Хранит распределенные затраты в разрезе: артикул + дата + кампания
 * uniqueKey = advertId_updTime_nmId (для исключения дублей)
 */
export interface AdExpense {
  id?: number
  uniqueKey: string // Составной ключ: advertId_updTime_nmId
  date: string // Дата затрат (ISO string, формат YYYY-MM-DD)
  sum: number // Сумма затрат, распределенная на этот артикул
  nmId: number // Артикул (nm_id)
  advertId: number // ID рекламной кампании
  campName?: string // Название кампании
  updTime?: number // Время обновления от WB (timestamp)
  createdAt?: number // Timestamp создания записи
  updatedAt?: number // Timestamp обновления записи
}

