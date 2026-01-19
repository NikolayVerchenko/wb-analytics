import type { IPurchaseItem, IProductCard } from '../../../types/db'

/**
 * Данные выбранного продукта из UI
 */
export interface ProductSelection {
  ni: number
  title: string
  sa: string
  weight: number | null
  img: string | null
  color?: string
}

/**
 * Интерфейс сервиса автозаполнения данных из productCards
 */
export interface IPurchasePrefillService {
  /**
   * Создаёт PurchaseItem из выбранного продукта и размеров
   * с автозаполнением данных из productCards
   */
  createItemsFromProduct(
    product: ProductSelection,
    sizes: string[],
    productCards: IProductCard[]
  ): IPurchaseItem[]
}
