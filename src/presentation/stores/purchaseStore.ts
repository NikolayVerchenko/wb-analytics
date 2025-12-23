import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@infrastructure/db/database'
import { container } from '@core/di/container'
import type { PurchaseOrder, PurchaseOrderStatus } from '@core/domain/entities/PurchaseOrder'
import type { PurchaseItem } from '@core/domain/entities/PurchaseItem'
import type { Product } from '@core/domain/entities/Product'
import type { FixedUnitCost } from '@core/domain/entities/FixedUnitCost'

export const usePurchaseStore = defineStore('purchase', () => {
  // State
  const orders = ref<PurchaseOrder[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function loadOrders(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      orders.value = await db.purchaseOrders.orderBy('date').reverse().toArray()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при загрузке заказов'
      console.error('Ошибка при загрузке заказов:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createOrder(orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    error.value = null
    try {
      const now = new Date().toISOString()
      const newOrder: PurchaseOrder = {
        ...orderData,
        status: orderData.status || 'draft',
        createdAt: now,
        updatedAt: now,
      }
      const id = await db.purchaseOrders.add(newOrder)
      await loadOrders() // Перезагружаем список
      return id
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при создании заказа'
      console.error('Ошибка при создании заказа:', err)
      throw err
    }
  }

  async function updateOrder(id: number, updates: Partial<PurchaseOrder>): Promise<void> {
    error.value = null
    try {
      const order = await db.purchaseOrders.get(id)
      if (!order) {
        throw new Error('Заказ не найден')
      }
      
      const updatedOrder: PurchaseOrder = {
        ...order,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      
      await db.purchaseOrders.update(id, updatedOrder)
      await loadOrders() // Перезагружаем список
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при обновлении заказа'
      console.error('Ошибка при обновлении заказа:', err)
      throw err
    }
  }

  async function deleteOrder(id: number): Promise<void> {
    error.value = null
    try {
      // Удаляем все товары заказа
      await db.purchaseItems.where('orderId').equals(id).delete()
      // Удаляем сам заказ
      await db.purchaseOrders.delete(id)
      await loadOrders() // Перезагружаем список
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при удалении заказа'
      console.error('Ошибка при удалении заказа:', err)
      throw err
    }
  }

  async function getOrderById(id: number): Promise<PurchaseOrder | undefined> {
    return await db.purchaseOrders.get(id)
  }

  // ========== Purchase Items Methods ==========

  async function getOrderItems(orderId: number): Promise<PurchaseItem[]> {
    return await db.purchaseItems.where('orderId').equals(orderId).toArray()
  }

  async function addOrderItem(item: Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt' | 'unitCostResult'>): Promise<number> {
    error.value = null
    try {
      const now = new Date().toISOString()
      
      // Получаем заказ для расчета себестоимости
      const order = await db.purchaseOrders.get(item.orderId)
      if (!order) {
        throw new Error('Заказ не найден')
      }

      // Получаем все товары заказа для расчета
      const allItems = await db.purchaseItems.where('orderId').equals(item.orderId).toArray()
      
      // Рассчитываем себестоимость
      const calculatedItem = await calculateCosts(item, order, [...allItems, item])
      
      const newItem: PurchaseItem = {
        ...calculatedItem,
        createdAt: now,
        updatedAt: now,
      }
      
      const id = await db.purchaseItems.add(newItem)
      
      // Пересчитываем все товары заказа (т.к. изменился общий вес/сумма)
      await recalculateOrderItems(item.orderId)
      
      return id
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при добавлении товара'
      console.error('Ошибка при добавлении товара:', err)
      throw err
    }
  }

  async function updateOrderItem(id: number, updates: Partial<PurchaseItem>): Promise<void> {
    error.value = null
    try {
      const item = await db.purchaseItems.get(id)
      if (!item) {
        throw new Error('Товар не найден')
      }

      const order = await db.purchaseOrders.get(item.orderId)
      if (!order) {
        throw new Error('Заказ не найден')
      }

      const updatedItem: PurchaseItem = {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      // Получаем все товары заказа для расчета
      const allItems = await db.purchaseItems.where('orderId').equals(item.orderId).toArray()
      const itemIndex = allItems.findIndex(i => i.id === id)
      if (itemIndex !== -1) {
        allItems[itemIndex] = updatedItem
      } else {
        allItems.push(updatedItem)
      }

      // Рассчитываем себестоимость
      const calculatedItem = await calculateCosts(updatedItem, order, allItems)
      
      await db.purchaseItems.update(id, calculatedItem)
      
      // Пересчитываем все товары заказа
      await recalculateOrderItems(item.orderId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при обновлении товара'
      console.error('Ошибка при обновлении товара:', err)
      throw err
    }
  }

  async function deleteOrderItem(id: number): Promise<void> {
    error.value = null
    try {
      const item = await db.purchaseItems.get(id)
      if (!item) {
        throw new Error('Товар не найден')
      }

      const orderId = item.orderId
      await db.purchaseItems.delete(id)
      
      // Пересчитываем все товары заказа после удаления
      await recalculateOrderItems(orderId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при удалении товара'
      console.error('Ошибка при удалении товара:', err)
      throw err
    }
  }

  async function recalculateOrderItems(orderId: number): Promise<void> {
    const order = await db.purchaseOrders.get(orderId)
    if (!order) return

    const items = await db.purchaseItems.where('orderId').equals(orderId).toArray()
    
    // Пересчитываем каждый товар с учетом всех остальных
    for (const item of items) {
      const calculatedItem = await calculateCosts(item, order, items)
      await db.purchaseItems.update(item.id!, {
        ...calculatedItem,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  /**
   * Рассчитывает себестоимость товара в заказе
   */
  async function calculateCosts(
    item: PurchaseItem | Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt' | 'unitCostResult'>,
    order: PurchaseOrder,
    allItems: (PurchaseItem | Omit<PurchaseItem, 'id' | 'createdAt' | 'updatedAt' | 'unitCostResult'>)[]
  ): Promise<PurchaseItem> {
    // 1. Сумма закупки за единицу: (PriceCNY * cnyRate)
    const purchaseSumPerUnit = item.priceCny * order.cnyRate

    // 2. Доставка по Китаю за единицу (CNY -> RUB)
    // chinaDelivery хранится как общая сумма на весь артикул, нужно разделить на общее количество единиц артикула
    const articleItems = allItems.filter(i => 
      i.nmId === item.nmId && 
      (item.vendorCode ? i.vendorCode === item.vendorCode : !i.vendorCode)
    )
    const articleTotalQuantity = articleItems.reduce((sum, i) => sum + i.quantity, 0)
    const chinaDeliveryPerUnit = articleTotalQuantity > 0 
      ? (item.chinaDelivery || 0) / articleTotalQuantity 
      : 0
    const chinaDeliveryRubPerUnit = chinaDeliveryPerUnit * order.cnyRate

    // 3. Рассчитываем общий вес заказа
    const totalWeight = allItems.reduce((sum, i) => {
      const itemWeight = i.weight || 0
      return sum + (itemWeight * i.quantity)
    }, 0)

    // 4. Доля доставки РФ на весь товар: (Weight_item / Total_Weight_Order) * totalRussiaDelivery
    const itemWeight = (item.weight || 0) * item.quantity
    const deliveryShareTotal = totalWeight > 0 
      ? (itemWeight / totalWeight) * order.totalRussiaDelivery 
      : 0
    const russiaDeliveryPerUnit = item.quantity > 0 ? deliveryShareTotal / item.quantity : 0

    // 5. Комиссия байера за единицу: процент от (стоимость единицы + доставка по Китаю)
    // Комиссия рассчитывается от суммы: (PriceCNY * cnyRate) + (chinaDelivery * cnyRate)
    const commissionPercent = order.buyerCommission / 100
    const baseForCommission = purchaseSumPerUnit + chinaDeliveryRubPerUnit
    const commissionPerUnit = baseForCommission * commissionPercent

    // 7. Прямые затраты за единицу: fulfillmentCost + packagingCost + kizCost
    const directCostsPerUnit = item.fulfillmentCost + item.packagingCost + item.kizCost

    // 8. Рассчитываем себестоимость за единицу
    // Все компоненты уже рассчитаны на единицу
    const unitCostResult = purchaseSumPerUnit + 
                          chinaDeliveryRubPerUnit + 
                          commissionPerUnit + 
                          russiaDeliveryPerUnit + 
                          directCostsPerUnit

    // Отладочная информация для проверки расчета
    console.log('🔍 Расчет себестоимости (store):', {
      nmId: item.nmId,
      size: item.size,
      quantity: item.quantity,
      priceCny: item.priceCny,
      cnyRate: order.cnyRate,
      chinaDelivery: item.chinaDelivery,
      articleTotalQuantity,
      chinaDeliveryPerUnit: chinaDeliveryPerUnit.toFixed(4),
      purchaseSumPerUnit: purchaseSumPerUnit.toFixed(2),
      chinaDeliveryRubPerUnit: chinaDeliveryRubPerUnit.toFixed(2),
      commissionPerUnit: commissionPerUnit.toFixed(2),
      russiaDeliveryPerUnit: russiaDeliveryPerUnit.toFixed(2),
      directCostsPerUnit: directCostsPerUnit.toFixed(2),
      unitCostResult: unitCostResult.toFixed(2),
    })

    // Отладочная информация (можно убрать после проверки)
    if (item.priceCny > 0 && unitCostResult < item.priceCny * order.cnyRate * 0.5) {
      console.warn('⚠️ Подозрительно низкая себестоимость:', {
        nmId: item.nmId,
        size: item.size,
        priceCny: item.priceCny,
        cnyRate: order.cnyRate,
        purchaseSumPerUnit,
        chinaDeliveryRubPerUnit,
        commissionPerUnit,
        russiaDeliveryPerUnit,
        directCostsPerUnit,
        unitCostResult,
      })
    }

    return {
      ...item,
      unitCostResult: parseFloat(unitCostResult.toFixed(2)),
    } as PurchaseItem
  }

  async function updateOrderItemsBatch(
    orderId: number,
    field: 'fulfillmentCost' | 'packagingCost' | 'kizCost',
    value: number
  ): Promise<void> {
    error.value = null
    try {
      const items = await db.purchaseItems.where('orderId').equals(orderId).toArray()
      
      for (const item of items) {
        await updateOrderItem(item.id!, { [field]: value })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при массовом обновлении'
      console.error('Ошибка при массовом обновлении:', err)
      throw err
    }
  }

  // ========== Fixed Unit Costs Methods ==========

  async function confirmOrderCosts(orderId: number): Promise<void> {
    error.value = null
    try {
      // Получаем заказ и все его товары
      const order = await db.purchaseOrders.get(orderId)
      if (!order) {
        throw new Error('Заказ не найден')
      }

      const items = await db.purchaseItems.where('orderId').equals(orderId).toArray()
      
      if (items.length === 0) {
        throw new Error('В заказе нет товаров')
      }

      // Валидация: проверяем подозрительные себестоимости
      const suspiciousItems: PurchaseItem[] = []
      for (const item of items) {
        const purchaseCost = item.priceCny * order.cnyRate
        if (item.unitCostResult === 0 || item.unitCostResult < purchaseCost * 0.5) {
          suspiciousItems.push(item)
        }
      }

      if (suspiciousItems.length > 0) {
        const itemDetails = suspiciousItems.map(i => 
          `nmId: ${i.nmId}, размер: ${i.size || '—'}, себестоимость: ${i.unitCostResult.toFixed(2)} ₽`
        ).join('\n')
        throw new Error(`Обнаружены подозрительные себестоимости:\n${itemDetails}\n\nПроверьте расчеты перед подтверждением.`)
      }

      // Сохраняем зафиксированные себестоимости
      const now = new Date().toISOString()
      const fixedCosts: FixedUnitCost[] = items.map(item => ({
        nmId: item.nmId,
        size: item.size,
        orderId: orderId,
        finalCost: item.unitCostResult,
        date: now,
        createdAt: now,
      }))

      await db.fixedUnitCosts.bulkAdd(fixedCosts)

      // Обновляем статус заказа на 'confirmed'
      await updateOrder(orderId, { status: 'confirmed' })

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка при подтверждении себестоимости'
      console.error('Ошибка при подтверждении себестоимости:', err)
      throw err
    }
  }

  async function getFixedCostsByOrder(orderId: number): Promise<FixedUnitCost[]> {
    return await db.fixedUnitCosts.where('orderId').equals(orderId).toArray()
  }

  async function getFixedCostsByNmId(nmId: number, size?: string): Promise<FixedUnitCost[]> {
    if (size) {
      return await db.fixedUnitCosts.where('[nmId+size]').equals([nmId, size]).toArray()
    }
    return await db.fixedUnitCosts.where('nmId').equals(nmId).toArray()
  }

  // Инициализация - загружаем заказы при создании store
  loadOrders()

  return {
    // State
    orders,
    isLoading,
    error,
    // Order Actions
    loadOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    getOrderById,
    // Item Actions
    getOrderItems,
    addOrderItem,
    updateOrderItem,
    deleteOrderItem,
    recalculateOrderItems,
    updateOrderItemsBatch,
    calculateCosts,
    // Fixed Costs Actions
    confirmOrderCosts,
    getFixedCostsByOrder,
    getFixedCostsByNmId,
  }
})

