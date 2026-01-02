export interface ShipmentGroup {
  id?: number
  name: string // Название группы
  date: string // Дата создания группы (ISO string)
  orderIds: number[] // Массив ID заказов на закупку (PurchaseOrder)
  shipmentIds: number[] // Массив ID поставок (Supply)
  createdAt?: string // Дата создания
  updatedAt?: string // Дата обновления
}

