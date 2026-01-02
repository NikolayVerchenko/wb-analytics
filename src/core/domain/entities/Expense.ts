export interface Expense {
  id?: number
  date: string
  type: string
  sum: number
  name: string
  nmId?: number
  category?: string
  advertId?: number // ID рекламной кампании (если это рекламная затрата)
}
