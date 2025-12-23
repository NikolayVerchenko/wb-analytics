import type { Product } from '@core/domain/entities/Product'
import type { ProductRepository } from '@infrastructure/repositories/ProductRepository'
import type { WBApiClient } from '@infrastructure/api/wbApiClient'
import type { LoggerService } from './LoggerService'

export class ProductService {
  constructor(
    private productRepository: ProductRepository,
    private apiClient: WBApiClient,
    private logger: LoggerService
  ) {}

  /**
   * Загружает карточки товаров с WB API и сохраняет их в базу данных
   * Реализует пагинацию через cursor до тех пор, пока total не станет 0
   */
  async fetchAndSyncProducts(): Promise<{ total: number; synced: number }> {
    this.logger.add('info', 'Начало синхронизации каталога товаров...')
    
    let cursor: { limit?: number; updatedAt?: string; nmID?: number } | undefined = undefined
    let totalSynced = 0
    let totalFetched = 0
    let batchNumber = 0
    let prevCursorNmID: number | undefined = undefined

    try {
      while (true) {
        batchNumber++
        this.logger.add('info', `Загрузка карточек товаров (пакет ${batchNumber})...`)

        // Получаем карточки с API
        const response = await this.apiClient.getProductCards(cursor)
        
        totalFetched = response.total
        const cards = response.cards || []
        
        if (cards.length === 0) {
          this.logger.add('info', 'Больше нет карточек для загрузки')
          break
        }

        this.logger.add('info', `Получено ${cards.length} карточек из API`)

        // Логируем структуру первой карточки для отладки (только при первом пакете)
        if (batchNumber === 1 && cards.length > 0) {
          console.log('[ProductService] Пример структуры карточки:', JSON.stringify(cards[0], null, 2))
          const testProduct = this.mapCardToProduct(cards[0])
          console.log('[ProductService] Преобразованная карточка:', JSON.stringify(testProduct, null, 2))
          console.log('[ProductService] Фото:', testProduct.photo)
          console.log('[ProductService] Вес:', testProduct.weight)
        }

        // Преобразуем карточки API в формат Product
        const products: Product[] = cards.map(card => this.mapCardToProduct(card))

        // Логируем первые несколько преобразованных товаров для отладки
        if (batchNumber === 1 && products.length > 0) {
          console.log('[ProductService] Первые 3 преобразованных товара:', products.slice(0, 3).map(p => ({
            nmId: p.nmId,
            title: p.title,
            photo: p.photo,
            weight: p.weight
          })))
        }

        // Сохраняем в базу данных (upsert - обновляет существующие или создает новые)
        await this.productRepository.upsertMany(products)
        
        // Проверяем, что сохранилось
        if (batchNumber === 1 && products.length > 0) {
          const savedProduct = await this.productRepository.getByNmId(products[0].nmId)
          console.log('[ProductService] Проверка сохраненного товара:', savedProduct)
          console.log('[ProductService] Тип photo:', typeof savedProduct?.photo, savedProduct?.photo)
          console.log('[ProductService] Тип weight:', typeof savedProduct?.weight, savedProduct?.weight)
          console.log('[ProductService] Что было отправлено на сохранение:', {
            nmId: products[0].nmId,
            photo: products[0].photo,
            weight: products[0].weight,
            photoType: typeof products[0].photo,
            weightType: typeof products[0].weight
          })
        }
        totalSynced += products.length

        this.logger.add('info', `Сохранено ${products.length} товаров в базу данных`)

        // Проверяем, есть ли еще данные для загрузки
        // Если количество полученных карточек меньше запрошенного лимита, значит загружены все
        const currentLimit = response.cursor?.limit || 100
        if (cards.length < currentLimit) {
          this.logger.add('info', 'Все карточки товаров загружены')
          break
        }

        // Проверяем, не застряли ли мы на том же месте (cursor не изменился)
        const currentCursorNmID = response.cursor?.nmID
        if (prevCursorNmID !== undefined && currentCursorNmID !== undefined && currentCursorNmID === prevCursorNmID) {
          this.logger.add('info', 'Достигнут конец списка карточек (cursor не изменился)')
          break
        }
        
        // Если cursor не содержит nmID, значит пагинация завершена
        if (!response.cursor || (response.cursor.nmID === undefined && response.cursor.updatedAt === undefined)) {
          this.logger.add('info', 'Пагинация завершена (нет следующего cursor)')
          break
        }

        // Обновляем cursor для следующей итерации
        prevCursorNmID = currentCursorNmID
        cursor = response.cursor

        // Небольшая задержка между запросами для соблюдения rate limits
        await this.sleep(500)
      }

      this.logger.add('success', `Синхронизация завершена. Всего синхронизировано: ${totalSynced} товаров`)
      
      return {
        total: totalFetched,
        synced: totalSynced,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      this.logger.add('error', `Ошибка при синхронизации каталога товаров: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Получает список товаров из базы данных
   */
  async getProducts(): Promise<Product[]> {
    return await this.productRepository.getAll()
  }

  /**
   * Получает товар по nmId
   */
  async getProductByNmId(nmId: number): Promise<Product | undefined> {
    return await this.productRepository.getByNmId(nmId)
  }

  /**
   * Получает товары по артикулу продавца
   */
  async getProductsByVendorCode(vendorCode: string): Promise<Product[]> {
    return await this.productRepository.getByVendorCode(vendorCode)
  }

  /**
   * Преобразует карточку из API в формат Product
   */
  private mapCardToProduct(card: any): Product {
    const now = new Date().toISOString()

    // Извлекаем фото: структура WB API v2 - массив объектов с разными размерами
    let photoUrl: string | undefined = undefined
    if (card.photos && Array.isArray(card.photos) && card.photos.length > 0) {
      const firstPhoto = card.photos[0]
      if (typeof firstPhoto === 'string') {
        // Если фото - это строка (URL)
        photoUrl = firstPhoto
      } else if (firstPhoto && typeof firstPhoto === 'object') {
        // WB API v2 возвращает объект с разными размерами: big, c246x328, c516x688, hq, square, tm
        // Используем c516x688 для среднего размера (хороший баланс качества и размера)
        // Или big для большого размера, или hq для высокого качества
        photoUrl = firstPhoto.c516x688 || firstPhoto.big || firstPhoto.hq || firstPhoto.square || 
                   firstPhoto.tm || firstPhoto.c246x328 || 
                   // Fallback на другие возможные поля
                   firstPhoto.url || firstPhoto.fileName || firstPhoto.file || firstPhoto.src || undefined
      }
    } else if (card.mediaFiles && Array.isArray(card.mediaFiles) && card.mediaFiles.length > 0) {
      // Альтернативное поле для фото
      const firstMedia = card.mediaFiles[0]
      if (typeof firstMedia === 'string') {
        photoUrl = firstMedia
      } else if (firstMedia && typeof firstMedia === 'object') {
        photoUrl = firstMedia.c516x688 || firstMedia.big || firstMedia.hq || 
                   firstMedia.url || firstMedia.fileName || firstMedia.file || firstMedia.src || undefined
      }
    } else if (card.photo) {
      // Прямое поле photo
      if (typeof card.photo === 'string') {
        photoUrl = card.photo
      } else if (card.photo && typeof card.photo === 'object') {
        photoUrl = card.photo.c516x688 || card.photo.big || card.photo.hq || 
                   card.photo.url || card.photo.fileName || undefined
      }
    }
    
    // Если фото - это относительный путь, формируем полный URL (на случай, если придет неполный URL)
    if (photoUrl && !photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
      if (photoUrl.startsWith('/')) {
        photoUrl = `https://basket-01.wb.ru${photoUrl}`
      } else if (photoUrl.startsWith('vol') || photoUrl.startsWith('c516x688')) {
        photoUrl = `https://basket-01.wb.ru/${photoUrl}`
      }
    }

    // Извлекаем вес: может быть в разных полях (конвертируем в граммы)
    let weight: number | undefined = undefined
    
    // WB API v2 возвращает вес в dimensions.weightBrutto (в килограммах)
    if (card.dimensions && card.dimensions.weightBrutto !== undefined && card.dimensions.weightBrutto !== null) {
      const weightKg = typeof card.dimensions.weightBrutto === 'number' 
        ? card.dimensions.weightBrutto 
        : parseFloat(card.dimensions.weightBrutto)
      if (!isNaN(weightKg) && weightKg > 0) {
        // Конвертируем из килограммов в граммы
        weight = Math.round(weightKg * 1000)
      }
    }
    
    // Если не нашли в dimensions, пробуем другие варианты полей для веса (уже в граммах)
    if (weight === undefined) {
      const weightFields = ['weight', 'weightGram', 'weightGrams', 'weight_gram', 'weight_grams', 'mass', 'massGram']
      for (const field of weightFields) {
        if (card[field] !== undefined && card[field] !== null) {
          const weightValue = typeof card[field] === 'number' ? card[field] : parseFloat(card[field])
          if (!isNaN(weightValue) && weightValue > 0) {
            weight = Math.round(weightValue)
            break
          }
        }
      }
    }
    
    // Если не нашли в корне карточки, проверяем в размерах
    if (weight === undefined && card.sizes && Array.isArray(card.sizes) && card.sizes.length > 0) {
      const firstSize = card.sizes[0]
      // Проверяем dimensions в размере
      if (firstSize.dimensions && firstSize.dimensions.weightBrutto !== undefined && firstSize.dimensions.weightBrutto !== null) {
        const weightKg = typeof firstSize.dimensions.weightBrutto === 'number' 
          ? firstSize.dimensions.weightBrutto 
          : parseFloat(firstSize.dimensions.weightBrutto)
        if (!isNaN(weightKg) && weightKg > 0) {
          weight = Math.round(weightKg * 1000)
        }
      }
      // Проверяем другие поля веса в размере
      if (weight === undefined) {
        const weightFields = ['weight', 'weightGram', 'weightGrams', 'weight_gram', 'weight_grams', 'mass', 'massGram']
        for (const field of weightFields) {
          if (firstSize[field] !== undefined && firstSize[field] !== null) {
            const weightValue = typeof firstSize[field] === 'number' ? firstSize[field] : parseFloat(firstSize[field])
            if (!isNaN(weightValue) && weightValue > 0) {
              weight = Math.round(weightValue)
              break
            }
          }
        }
      }
    }
    
    // Если вес не найден, устанавливаем 0 (по умолчанию)
    if (weight === undefined) {
      weight = 0
    }

    return {
      nmId: card.nmID || card.nmId || 0,
      vendorCode: card.vendorCode || card.supplierArticle || undefined,
      title: card.title || card.name || undefined,
      brand: card.brand || undefined,
      photo: photoUrl,
      sizes: card.sizes ? card.sizes.map((size: any) => ({
        techSize: size.techSize,
        barcode: size.barcode || (size.skus && size.skus.length > 0 ? size.skus[0] : undefined),
        chrtId: size.chrtID || size.chrtId, // API возвращает chrtID, но мы используем chrtId в нашей модели
      })) : undefined,
      category: card.subject || card.category || undefined,
      subject: card.subject || undefined,
      supplierArticle: card.supplierArticle || card.vendorCode || undefined,
      barcode: card.barcode || (card.sizes && card.sizes.length > 0 ? card.sizes[0].barcode : undefined),
      techSize: card.techSize || undefined,
      weight: weight,
      createdAt: card.createdAt || now,
      lastUpdated: now,
    }
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}



