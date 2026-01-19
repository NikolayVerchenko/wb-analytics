import { ref, computed } from 'vue'
import type { IPurchase, IPurchaseItem, IProductCard } from '../types/db'
import type { PurchaseService } from '../application/purchases/PurchaseService'
import type { GroupedPurchase } from '../core/domain/purchases/types'
import type { ProductSelection } from '../core/domain/purchases/IPurchasePrefillService'
import type { ItemCostCalculation } from '../core/domain/purchases/types'

/**
 * Composable для работы с закупками в Vue компонентах
 * Инкапсулирует состояние формы, список закупок и вызывает сервис
 */
export function usePurchases(
  purchaseService: PurchaseService,
  productCards: IProductCard[],
  callbacks?: {
    onSuccess?: (message: string) => void
    onError?: (message: string) => void
    onNavigate?: (path: string, query?: Record<string, any>) => void
  }
) {
  const purchases = ref<IPurchase[]>([])
  const isLoading = ref(false)

  // Функция для получения следующего номера заказа (автоинкремент)
  const getNextOrderNumber = (): string => {
    if (purchases.value.length === 0) {
      return '1'
    }
    
    // Извлекаем числовые части из номеров заказов
    const numbers = purchases.value
      .map(p => {
        // Пытаемся извлечь число из номера заказа
        // Поддерживаем форматы: "1", "ORD-001", "Заказ #5", и т.д.
        const match = p.orderNumber?.match(/\d+/)
        return match ? parseInt(match[0], 10) : 0
      })
      .filter(n => n > 0)
    
    if (numbers.length === 0) {
      return '1'
    }
    
    const maxNumber = Math.max(...numbers)
    return String(maxNumber + 1)
  }

  // State - инициализация с номером заказа будет выполнена после загрузки закупок
  const form = ref<Omit<IPurchase, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    orderNumber: '1', // Временное значение, будет обновлено после загрузки
    status: 'pending',
    exchangeRate: 12.5,
    buyerCommissionPercent: 5,
    logisticsToMoscow: 0,
    items: [],
  })
  
  // ID редактируемой закупки (undefined для новой закупки)
  const editingPurchaseId = ref<number | undefined>(undefined)
  
  // Флаг для отслеживания первой загрузки
  let isFirstLoad = true

  // Computed
  const groupedProducts = computed<GroupedPurchase[]>(() => {
    return purchaseService.groupPurchasesByNmID(form.value.items, productCards)
  })

  const totals = computed(() => {
    return purchaseService.calculator.calculateSummary(form.value as IPurchase)
  })

  const canSave = computed(() => {
    return (
      form.value.date &&
      form.value.date.trim() !== '' &&
      form.value.orderNumber &&
      form.value.orderNumber.trim() !== '' &&
      form.value.items.length > 0 &&
      form.value.items.every(
        item => item.nmID > 0 && item.techSize && item.quantity > 0
      )
    )
  })

  // Methods
  const addItemsFromProduct = (product: ProductSelection, sizes: string[]) => {
    const updatedPurchase = purchaseService.addItemsFromProduct(
      form.value,
      product,
      sizes,
      productCards
    )
    
    // Обновляем напрямую items для лучшей реактивности
    form.value.items = updatedPurchase.items
    
    // НЕ вызываем onSuccess при добавлении товаров, т.к. это не действие пользователя, требующее редиректа
    // onSuccess должен вызываться только при сохранении закупки
  }

  const save = async () => {
    try {
      isLoading.value = true
      // Если редактируем существующую закупку, добавляем ID
      const purchaseToSave: IPurchase = editingPurchaseId.value
        ? { ...form.value, id: editingPurchaseId.value }
        : (form.value as IPurchase)
      
      await purchaseService.savePurchase(purchaseToSave)
      callbacks?.onSuccess?.(editingPurchaseId.value ? 'Закупка успешно обновлена' : 'Закупка успешно сохранена')
      
      // Сначала загружаем обновленный список закупок, затем сбрасываем форму с правильным номером
      await loadPurchases()
      reset()
    } catch (error) {
      // Показываем конкретное сообщение об ошибке или общее
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при сохранении закупки'
      callbacks?.onError?.(errorMessage)
      // Не пробрасываем ошибку дальше, так как она уже обработана
      console.error('[usePurchases] Error saving purchase:', error)
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    form.value = {
      date: new Date().toISOString().split('T')[0],
      orderNumber: getNextOrderNumber(),
      status: 'pending',
      exchangeRate: 12.5,
      buyerCommissionPercent: 5,
      logisticsToMoscow: 0,
      items: [],
    }
    editingPurchaseId.value = undefined
  }
  
  // Загрузка закупки в форму для редактирования
  const loadPurchaseForEdit = async (id: number) => {
    try {
      const purchase = await purchaseService.getPurchaseById(id)
      if (!purchase) {
        callbacks?.onError?.('Закупка не найдена')
        return
      }
      
      // Загружаем данные закупки в форму
      form.value = {
        date: purchase.date,
        orderNumber: purchase.orderNumber,
        status: purchase.status,
        exchangeRate: purchase.exchangeRate,
        buyerCommissionPercent: purchase.buyerCommissionPercent,
        logisticsToMoscow: purchase.logisticsToMoscow,
        items: JSON.parse(JSON.stringify(purchase.items)), // Клонируем массив items
      }
      editingPurchaseId.value = purchase.id
      // НЕ вызываем onSuccess, т.к. это не действие пользователя, а просто загрузка данных
      // onSuccess должен вызываться только при сохранении
      
      // Прокручиваем к началу формы для удобства
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при загрузке закупки'
      callbacks?.onError?.(errorMessage)
      console.error('[usePurchases] Error loading purchase for edit:', error)
    }
  }

  const loadPurchases = async () => {
    try {
      purchases.value = await purchaseService.loadPurchases()
      // Обновляем номер заказа только при первой загрузке, если он пустой или равен временному значению
      if (isFirstLoad && (!form.value.orderNumber || form.value.orderNumber.trim() === '' || form.value.orderNumber === '1')) {
        form.value.orderNumber = getNextOrderNumber()
        isFirstLoad = false
      }
    } catch (error) {
      callbacks?.onError?.('Ошибка при загрузке закупок')
    }
  }

  const deletePurchase = async (id: number) => {
    try {
      await purchaseService.deletePurchase(id)
      callbacks?.onSuccess?.('Закупка удалена')
      await loadPurchases()
    } catch (error) {
      callbacks?.onError?.('Ошибка при удалении закупки')
    }
  }

  const removeGroup = (nmID: number) => {
    form.value = purchaseService.removeGroup(form.value, nmID)
    callbacks?.onSuccess?.('Группа товаров удалена')
  }

  const removeItem = (nmID: number, techSize: string) => {
    form.value = purchaseService.removeItem(form.value, nmID, techSize)
    callbacks?.onSuccess?.('Товар удален')
  }

  const applyValueToGroup = (
    nmID: number,
    field: keyof IPurchaseItem,
    value: number
  ) => {
    form.value = purchaseService.applyValueToGroup(form.value, nmID, field, value)
  }

  const getGroupValue = (nmID: number, field: keyof IPurchaseItem): number => {
    return purchaseService.getGroupValue(form.value.items, nmID, field)
  }

  const calculateItemCost = (item: IPurchaseItem): ItemCostCalculation => {
    return purchaseService.calculator.calculateItemCost(item, form.value as IPurchase)
  }

  const applyToSupply = (purchase: IPurchase) => {
    callbacks?.onNavigate?.('/shipments', {
      applyPurchase: purchase.id,
      purchaseId: purchase.id,
    })
  }

  return {
    // State
    form,
    purchases,
    isLoading,
    editingPurchaseId,
    // Computed
    groupedProducts,
    totals,
    canSave,
    // Methods
    addItemsFromProduct,
    save,
    reset,
    loadPurchases,
    loadPurchaseForEdit,
    deletePurchase,
    removeGroup,
    removeItem,
    applyValueToGroup,
    getGroupValue,
    calculateItemCost,
    applyToSupply,
  }
}
