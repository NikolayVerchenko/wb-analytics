import type { IPurchasePrefillService } from '../../core/domain/purchases/IPurchasePrefillService'
import type { IPurchaseItem, IProductCard } from '../../types/db'
import type { ProductSelection } from '../../core/domain/purchases/IPurchasePrefillService'

/**
 * Реализация сервиса автозаполнения данных из productCards
 */
export class ProductCardPrefillService implements IPurchasePrefillService {
  /**
   * Создаёт PurchaseItem из выбранного продукта и размеров
   * с автозаполнением данных из productCards
   */
  createItemsFromProduct(
    product: ProductSelection,
    sizes: string[],
    productCards: IProductCard[]
  ): IPurchaseItem[] {
    const items: IPurchaseItem[] = []

    for (const size of sizes) {
      const card = productCards.find(c => c.ni === product.ni && c.sz === size)

      // Автозаполнение веса (конвертация из граммов в кг, если нужно)
      let weightInKg: number | undefined = undefined
      if (card?.weight) {
        weightInKg = card.weight > 1000 ? card.weight / 1000 : card.weight
      } else if (product.weight) {
        weightInKg = product.weight
      }

      items.push({
        nmID: product.ni,
        vendorCode: card?.sa || product.sa || '',
        title: card?.title || product.title || '',
        color: product.color || '',
        techSize: size,
        weightPerUnit: weightInKg,
        priceCNY: 0,
        logisticsCNY: 0,
        fulfillmentRUB: 0,
        packagingRUB: 0,
        kizRUB: 0,
        quantity: 1,
      })
    }

    return items
  }
}
