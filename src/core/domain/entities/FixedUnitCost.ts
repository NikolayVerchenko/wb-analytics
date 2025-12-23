export interface FixedUnitCost {
  id?: number
  nmId: number // Артикул WB
  size?: string // Размер товара
  orderId: number // ID заказа на закупку
  finalCost: number // Финальная себестоимость за единицу (руб)
  date: string // Дата фиксации (ISO string)
  createdAt?: string // Дата создания записи
}

