export interface ProductSize {
  techSize?: string
  barcode?: string
  chrtId?: number
}

export interface Product {
  id?: number
  nmId: number // Артикул WB (ключ)
  vendorCode?: string // Артикул продавца
  title?: string // Название товара
  brand?: string // Бренд
  photo?: string // URL фото товара
  sizes?: ProductSize[] // Массив размеров
  category?: string // Категория (subject_name)
  subject?: string // Предмет (subject_name)
  supplierArticle?: string // Артикул поставщика
  barcode?: string // Баркод
  techSize?: string // Технический размер
  weight?: number // Вес товара в граммах (дефолт 0)
  createdAt?: string // Дата создания
  lastUpdated: string // Дата последнего обновления
}
