import type { IPurchaseRepository } from '../../core/domain/purchases/IPurchaseRepository'
import type { IPurchaseCalculator } from '../../core/domain/purchases/IPurchaseCalculator'
import type { IPurchasePrefillService, ProductSelection } from '../../core/domain/purchases/IPurchasePrefillService'
import type { IPurchase, IPurchaseItem, IProductCard } from '../../types/db'
import type { GroupedPurchase } from '../../core/domain/purchases/types'

/**
 * Сервис для работы с закупками
 * Оркестрирует работу репозитория, калькулятора и сервиса автозаполнения
 */
export class PurchaseService {
  constructor(
    public readonly repository: IPurchaseRepository,
    public readonly calculator: IPurchaseCalculator,
    private prefillService: IPurchasePrefillService
  ) {}

  async loadPurchases(): Promise<IPurchase[]> {
    return this.repository.getAll()
  }

  async getPurchaseById(id: number): Promise<IPurchase | undefined> {
    return this.repository.getById(id)
  }

  async savePurchase(purchase: IPurchase): Promise<number> {
    // Валидация перед сохранением
    this.validatePurchase(purchase)
    return this.repository.save(purchase)
  }

  async deletePurchase(id: number): Promise<void> {
    return this.repository.delete(id)
  }

  /**
   * Добавляет товары из выбранного продукта и размеров
   */
  addItemsFromProduct(
    purchase: IPurchase,
    product: ProductSelection,
    sizes: string[],
    productCards: IProductCard[]
  ): IPurchase {
    const newItems = this.prefillService.createItemsFromProduct(product, sizes, productCards)
    
    return {
      ...purchase,
      items: [...purchase.items, ...newItems],
    }
  }

  /**
   * Группирует товары по nmID для отображения
   */
  groupPurchasesByNmID(items: IPurchaseItem[], productCards: IProductCard[]): GroupedPurchase[] {
    const groupsMap = new Map<number, GroupedPurchase>()

    for (const item of items) {
      if (!groupsMap.has(item.nmID)) {
        // Ищем productCard - сначала по nmID и размеру, потом просто по nmID
        const cardWithSize = productCards.find(c => c.ni === item.nmID && c.sz === item.techSize)
        const firstCard = cardWithSize || productCards.find(c => c.ni === item.nmID)
        
        // Изображение берется из productCard (item не хранит img)
        let imgUrl: string | null = null
        if (cardWithSize?.img) {
          imgUrl = cardWithSize.img
        } else if (firstCard?.img) {
          imgUrl = firstCard.img
        }
        
        // Нормализуем URL изображения
        if (imgUrl && typeof imgUrl === 'string') {
          imgUrl = imgUrl.trim()
          if (imgUrl === '') {
            imgUrl = null
          }
        } else {
          imgUrl = null
        }
        
        groupsMap.set(item.nmID, {
          nmID: item.nmID,
          title: item.title || firstCard?.title || `Артикул ${item.nmID}`,
          vendorCode: item.vendorCode || firstCard?.sa || '',
          img: imgUrl,
          color: item.color || '',
          items: [],
          totalQuantity: 0,
        })
      }

      const group = groupsMap.get(item.nmID)!
      group.items.push(item)
      group.totalQuantity += item.quantity || 0
    }

    return Array.from(groupsMap.values())
  }

  /**
   * Применяет значение ко всем размерам артикула
   */
  applyValueToGroup(
    purchase: IPurchase,
    nmID: number,
    field: keyof IPurchaseItem,
    value: number
  ): IPurchase {
    const result = {
      ...purchase,
      items: purchase.items.map(item => {
        if (item.nmID === nmID) {
          return {
            ...item,
            [field]: value,
          }
        }
        return item
      }),
    }
    
    return result
  }

  /**
   * Удаляет все товары артикула из закупки
   */
  removeGroup(purchase: IPurchase, nmID: number): IPurchase {
    return {
      ...purchase,
      items: purchase.items.filter(item => item.nmID !== nmID),
    }
  }

  /**
   * Удаляет конкретный товар (nmID + techSize)
   */
  removeItem(purchase: IPurchase, nmID: number, techSize: string): IPurchase {
    return {
      ...purchase,
      items: purchase.items.filter(
        item => !(item.nmID === nmID && item.techSize === techSize)
      ),
    }
  }

  /**
   * Получает первое непустое значение поля для группы
   */
  getGroupValue(items: IPurchaseItem[], nmID: number, field: keyof IPurchaseItem): number {
    const groupItems = items.filter(item => item.nmID === nmID)
    
    const item = groupItems.find(i => {
      const value = i[field]
      const isValid = value !== undefined && value !== null && (typeof value === 'number' ? value > 0 : false)
      return isValid
    })
    
    const result = item ? (item[field] as number) : 0
    return result
  }

  private validatePurchase(purchase: IPurchase): void {
    if (!purchase.date || purchase.date.trim() === '') {
      throw new Error('Дата закупки обязательна')
    }
    if (!purchase.orderNumber || purchase.orderNumber.trim() === '') {
      throw new Error('Номер заказа обязателен')
    }
    if (purchase.items.length === 0) {
      throw new Error('Закупка должна содержать хотя бы один товар')
    }
    // Дополнительная валидация
    for (const item of purchase.items) {
      if (!item.nmID || !item.techSize || !item.quantity || item.quantity <= 0) {
        throw new Error('Все товары должны иметь корректные nmID, размер и количество')
      }
    }
  }
}
