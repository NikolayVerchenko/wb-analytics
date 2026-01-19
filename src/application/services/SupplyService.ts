import type { IWBApiClient } from '../../core/domain/repositories/IWBApiClient'
import type { IDatabaseRepository } from '../../core/domain/repositories/IDatabaseRepository'
import type { IPurchaseRepository } from '../../core/domain/purchases/IPurchaseRepository'
import type { IPurchaseCalculator } from '../../core/domain/purchases/IPurchaseCalculator'
import type { ISupply, ISupplyItem } from '../../types/db'

export class SupplyService {
  constructor(
    private apiClient: IWBApiClient,
    private repository: IDatabaseRepository,
    private purchaseRepository?: IPurchaseRepository,
    private purchaseCalculator?: IPurchaseCalculator
  ) {}

  async loadSuppliesFromApi(dateFrom: string, dateTo: string): Promise<number> {
    const suppliesList = await this.apiClient.getSupplies({
      dateFrom,
      dateTo,
      statusIDs: [5, 6] // Статусы: 5 - Принято, 6 - Отгружено на воротах
    })

    console.log(`Загружено поставок из API: ${suppliesList.length}`)
    if (suppliesList.length > 0) {
      console.log('Первая поставка:', JSON.stringify(suppliesList[0]))
    }

    let savedCount = 0

    // Для каждой поставки с supplyID загружаем состав товаров
    for (let i = 0; i < suppliesList.length; i++) {
      const supply = suppliesList[i]
      if (!supply.supplyID) {
        continue // Пропускаем поставки без supplyID
      }

      // Задержка перед каждым запросом для соблюдения лимита API (300 мс)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      let retryCount = 0
      const maxRetries = 1000
      let success = false

      while (!success && retryCount < maxRetries) {
        try {
          const goods = await this.apiClient.getSupplyGoods(supply.supplyID)

          // Получаем существующую поставку из БД, чтобы сохранить себестоимость
          const existingSupply = await this.repository.getSupplyById(supply.supplyID)
          
          // Создаем Map существующих себестоимостей: ключ = `${nmID}_${techSize}`, значение = cost
          const existingCostsMap = new Map<string, number | undefined>()
          if (existingSupply && existingSupply.items) {
            for (const item of existingSupply.items) {
              const key = `${item.nmID}_${item.techSize}`
              existingCostsMap.set(key, item.cost)
            }
          }

          // Формируем даты в формате YYYY-MM-DD
          const formatDateOnly = (dateStr: string | null): string | null => {
            if (!dateStr) return null
            return dateStr.split('T')[0]
          }

          const createDateOnly = formatDateOnly(supply.createDate)
          const factDateOnly = formatDateOnly(supply.factDate)
          const supplyDateOnly = formatDateOnly(supply.supplyDate)

          // Формируем объект поставки для сохранения с сохранением существующих себестоимостей
          const supplyToSave: ISupply = {
            supplyID: supply.supplyID,
            factDate: factDateOnly,
            createDate: createDateOnly || supply.createDate.split('T')[0],
            supplyDate: supplyDateOnly,
            items: goods.map(g => {
              const costKey = `${g.nmID}_${g.techSize}`
              const existingCost = existingCostsMap.get(costKey)
              
              const item: ISupplyItem = {
                nmID: g.nmID,
                techSize: g.techSize,
                quantity: g.quantity,
                acceptedQuantity: g.acceptedQuantity,
              }
              
              // Сохраняем себестоимость, если она была установлена ранее
              if (existingCost !== undefined) {
                item.cost = existingCost
              }
              
              return item
            }),
          }

          // Сохраняем поставку в БД (put обновит, если уже существует)
          await this.repository.saveSupply(supplyToSave)
          savedCount++
          success = true
        } catch (error: any) {
          // Обработка ошибки 429 (Too Many Requests)
          if (error?.response?.status === 429) {
            retryCount++
            const waitTime = 2000 * retryCount // Увеличиваем время ожидания с каждой попыткой: 2с, 4с, 6с
            console.warn(
              `[SupplyService] Лимит запросов (429) для поставки ${supply.supplyID}. Попытка ${retryCount}/${maxRetries}. Ожидание ${waitTime / 1000} сек...`
            )
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue // Повторяем запрос
          }

          // Для других ошибок логируем и пропускаем поставку
          console.error(`[SupplyService] Ошибка при загрузке товаров для поставки ${supply.supplyID}:`, error.message)
          break // Прекращаем попытки для этой поставки
        }
      }

      if (!success) {
        console.warn(`[SupplyService] Не удалось загрузить поставку ${supply.supplyID} после ${maxRetries} попыток`)
      }
    }

    console.log(`[SupplyService] Сохранено поставок в БД: ${savedCount}`)
    return savedCount
  }

  async getAllSupplies(): Promise<ISupply[]> {
    const supplies = await this.repository.getSupplies()
    // Сортируем по factDate (от новых к старым), если factDate null, то по createDate
    return supplies.sort((a, b) => {
      const dateA = a.factDate || a.createDate || ''
      const dateB = b.factDate || b.createDate || ''
      return dateB.localeCompare(dateA) // Обратный порядок (новые первыми)
    })
  }

  async getSupplyByNmId(nmId: number): Promise<ISupply[]> {
    const allSuppliesData = await this.repository.getSupplies()
    return allSuppliesData.filter(supply =>
      supply.items.some(item => item.nmID === nmId)
    )
  }

  async updateSupplyItemCost(
    supplyID: number,
    nmID: number,
    techSize: string,
    newCost: number | undefined
  ): Promise<void> {
    console.log(`[SupplyService] updateSupplyItemCost: вызов, supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}, newCost=${newCost}`)
    await this.repository.updateSupplyItemCost(supplyID, nmID, techSize, newCost)
    console.log(`[SupplyService] updateSupplyItemCost: успешно завершено`)
  }

  async applyPurchaseToSupply(purchaseID: number, supplyID: number): Promise<void> {
    if (!this.purchaseRepository || !this.purchaseCalculator) {
      throw new Error('PurchaseRepository and PurchaseCalculator must be provided to applyPurchaseToSupply')
    }

    const purchase = await this.purchaseRepository.getById(purchaseID)
    if (!purchase) {
      throw new Error(`Закупка с ID ${purchaseID} не найдена`)
    }

    const supply = await this.repository.getSupplyById(supplyID)
    if (!supply) {
      throw new Error(`Поставка с ID ${supplyID} не найдена`)
    }

    // Создаем Map цен из закупки по nmID (средняя себестоимость для каждого nmID)
    const purchaseCostMap = new Map<number, number>()
    for (const item of purchase.items) {
      // Рассчитываем себестоимость для товара из закупки
      const costCalculation = this.purchaseCalculator.calculateItemCost(item, purchase)
      const costInRUB = costCalculation.costPerUnit

      // Используем среднюю цену, если товар уже есть в Map
      if (purchaseCostMap.has(item.nmID)) {
        const existingCost = purchaseCostMap.get(item.nmID)!
        purchaseCostMap.set(item.nmID, (existingCost + costInRUB) / 2)
      } else {
        purchaseCostMap.set(item.nmID, costInRUB)
      }
    }

    // Применяем цены к товарам в поставке
    const updatedItems = supply.items.map((item: ISupplyItem) => {
      if (purchaseCostMap.has(item.nmID)) {
        return {
          ...item,
          cost: purchaseCostMap.get(item.nmID)!,
        }
      }
      return item
    })

    // Сохраняем обновленную поставку
    const updatedSupply = {
      ...supply,
      items: updatedItems,
    }
    await this.repository.saveSupply(updatedSupply)
  }
}
