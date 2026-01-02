/**
 * Маппинг рекламной кампании к артикулам
 * Связывает advertId (ID рекламной кампании) с массивом nm_id (артикулов)
 */
export interface AdMapping {
  id?: number
  advertId: number // ID рекламной кампании
  nmIds: number[] // Массив артикулов, участвующих в кампании
  createdAt?: string // Дата создания записи
  updatedAt?: string // Дата обновления записи
}

