export type PurchaseOrderStatus = 'DRAFT' | 'IN_CHINA' | 'IN_TRANSIT' | 'AT_FULFILLMENT' | 'SHIPPED_TO_WB'

export interface PurchaseOrderStatusHistory {
  inChinaDate?: string // Дата прибытия в Китай (ISO string)
  inTransitDate?: string // Дата отправки из Китая (ISO string)
  atFulfillmentDate?: string // Дата прибытия на фулфилмент (ISO string)
  shippedToWbDate?: string // Дата отгрузки на ВБ (ISO string)
}

export interface PurchaseOrder {
  id?: number
  orderNumber: string // Номер заказа
  date: string // Дата заказа (ISO string)
  cnyRate: number // Курс юаня
  totalChinaDelivery: number // Стоимость доставки в Китае (CNY)
  totalRussiaDelivery: number // Стоимость доставки в России (RUB)
  buyerCommission: number // Комиссия байера (%)
  status: PurchaseOrderStatus // Статус заказа (по умолчанию 'draft')
  statusHistory?: PurchaseOrderStatusHistory // История переходов статусов с датами
  createdAt?: string // Дата создания
  updatedAt?: string // Дата обновления
}

