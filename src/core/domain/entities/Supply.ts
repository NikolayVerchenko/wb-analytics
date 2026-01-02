export interface SupplyItem {
  barcode?: string // Баркод товара
  vendorCode?: string // Артикул продавца
  nmID: number // Артикул WB (используем nmID для соответствия API)
  needKiz?: boolean // Нужен ли код маркировки
  tnved?: string | null // Код ТНВЭД
  techSize?: string // Размер товара, указанный продавцом
  color?: string | null // Цвет товара
  supplierBoxAmount?: number | null // Указано в упаковке, шт
  quantity: number // Указано в поставке/заказе, шт
  readyForSaleQuantity?: number | null // Поступило в продажу, шт
  acceptedQuantity?: number | null // Принято, шт
  unloadingQuantity?: number | null // Количество товара на раскладке, шт
  // Дополнительные поля для обогащения данными из заказа
  unitCostResult?: number // Себестоимость единицы (из привязанного заказа) - для обратной совместимости
  size?: string // Размер из заказа (для сопоставления)
  // Информация о частичной привязке к заказам
  allocations?: Array<{
    orderId: number // ID заказа на закупку
    allocatedQty: number // Количество товара, привязанное к этому заказу
    unitCost: number // Себестоимость единицы из этого заказа
  }> // Массив связей с заказами для поддержки частичной привязки
}

export interface Supply {
  id?: number
  supplyID: string | null // ID поставки из WB API (может быть null)
  preorderID?: string | number // ID предзаказа
  createDate: string // Дата создания поставки (ISO)
  statusID: number // Статус поставки (1-6)
  factDate?: string | null // Фактическая дата (ISO, может быть null)
  // orderId и orderIds удалены - теперь используется автоматический FIFO учет
  quantity?: number // Общее количество товаров в поставке (вычисляется из items)
  items?: SupplyItem[] // Состав товаров в поставке (nmId и quantity)
  coverageStatus?: 'full' | 'partial' | 'empty' // Статус покрытия себестоимостью (вычисляется из allocations)
  uncoveredItemsCount?: number // Количество товаров без себестоимости
  fifoStatus?: 'ok' | 'deficit' // Статус списания: ok - все найдено, deficit - дефицит закупок
  createdAt?: string
  updatedAt?: string
}

