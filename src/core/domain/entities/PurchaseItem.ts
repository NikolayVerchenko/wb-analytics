export interface PurchaseItem {
  id?: number
  orderId: number // ID заказа на закупку
  nmId: number // Артикул WB
  vendorCode?: string // Артикул продавца
  size?: string // Размер товара
  quantity: number // Количество
  priceCny: number // Цена в CNY
  weight?: number // Вес товара (подтягивается из products)
  chinaDelivery: number // Доставка по Китаю для этого артикула (CNY)
  fulfillmentCost: number // Стоимость фулфилмента (руб)
  packagingCost: number // Стоимость упаковки (руб)
  kizCost: number // Стоимость КИЗ (руб)
  unitCostResult: number // Итоговая себестоимость за единицу (руб)
  createdAt?: string // Дата создания
  updatedAt?: string // Дата обновления
}
