export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface PurchaseOrder {
  id?: number
  orderNumber: string // Номер заказа
  date: string // Дата заказа (ISO string)
  cnyRate: number // Курс юаня
  totalChinaDelivery: number // Стоимость доставки в Китае (CNY)
  totalRussiaDelivery: number // Стоимость доставки в России (RUB)
  buyerCommission: number // Комиссия байера (%)
  status: PurchaseOrderStatus // Статус заказа (по умолчанию 'draft')
  createdAt?: string // Дата создания
  updatedAt?: string // Дата обновления
}

