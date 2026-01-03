import { ref } from 'vue'
import { WbApiClient } from '../WbApiClient'
import { db } from '../../db/db'
import type { IProductCard } from '../../types/db'

/**
 * Fetcher для загрузки карточек товаров (справочник)
 * Загружает данные через POST запрос с пагинацией через cursor
 */
export class ContentFetcher {
  private apiClient: WbApiClient
  private readonly API_RATE_LIMIT_MS = 700 // 700 миллисекунд между запросами (лимит API: 5 запросов в 600 мс)

  // Реактивные поля для отслеживания прогресса
  public readonly loadedCount = ref<number>(0)
  public readonly isFetching = ref<boolean>(false)
  public readonly error = ref<string | null>(null)

  constructor(apiClient: WbApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Генерирует Primary Key для записи карточки товара
   * Формат: ${ni}_${sz} (Артикул WB_Размер)
   */
  private generatePK(ni: number, sz: string): string {
    return `${ni}_${sz}`
  }

  /**
   * Задержка между запросами для соблюдения лимита API
   */
  private async waitForRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.API_RATE_LIMIT_MS))
  }

  /**
   * Загружает карточки товаров и сохраняет в БД
   * Использует пагинацию через cursor
   * @returns Общее количество загруженных записей
   */
  async fetchCards(): Promise<number> {
    // Сброс состояния
    this.loadedCount.value = 0
    this.isFetching.value = true
    this.error.value = null

    try {
      console.log(`[ContentFetcher] Начало загрузки карточек товаров`)

      const cardsMap = new Map<string, IProductCard>()
      let cursor: { updatedAt?: string; nmID?: number } | undefined = undefined
      let pageNumber = 1
      let totalCards = 0

      // Пагинация: запрашиваем данные пока total >= limit
      while (true) {
        console.log(`[ContentFetcher] Запрос страницы ${pageNumber}...`)

        const response = await this.apiClient.fetchCardsList(cursor)
        const cards = response.cards || []
        const cursorData = response.cursor

        if (cards.length === 0) {
          console.log(`[ContentFetcher] Страница ${pageNumber}: данных не найдено, завершаем пагинацию`)
          break
        }

        console.log(`[ContentFetcher] Страница ${pageNumber}: получено ${cards.length} карточек`)

        // Обрабатываем каждую карточку
        // Используем flatMap для создания записи для каждого размера
        const cardRecords: IProductCard[] = []

        for (const card of cards) {
          const nmID = card.nmID
          const sizes = card.sizes || []

          if (!nmID || sizes.length === 0) {
            continue
          }

          // Для каждого размера создаем отдельную запись
          for (const size of sizes) {
            const techSize = size.techSize || ''
            if (!techSize) {
              continue
            }

            const pk = this.generatePK(nmID, techSize)
            const photos = card.photos || []
            const img = photos.length > 0 && photos[0].tm ? photos[0].tm : ''
            const dimensions = card.dimensions || {}
            const dims = `${dimensions.length || 0}x${dimensions.width || 0}x${dimensions.height || 0}`
            const weight = dimensions.weightBrutto || 0

            cardRecords.push({
              pk,
              ni: nmID,
              sz: techSize,
              sj: card.subjectName || '',
              sa: card.vendorCode || '',
              bc: card.brand || '',
              title: card.title || '',
              img,
              dims,
              weight,
            })
          }
        }

        // Добавляем записи в Map (перезаписываем дубликаты по PK)
        for (const record of cardRecords) {
          cardsMap.set(record.pk, record)
        }

        totalCards += cardRecords.length
        console.log(`[ContentFetcher] Страница ${pageNumber}: обработано ${cardRecords.length} записей (размеров)`)

        // Проверяем условие выхода: total < limit
        if (cursorData.total < cursorData.limit) {
          console.log(`[ContentFetcher] Страница ${pageNumber}: total (${cursorData.total}) < limit (${cursorData.limit}) - это последняя страница`)
          break
        }

        // Обновляем cursor для следующей итерации
        if (cursorData.updatedAt && cursorData.nmID) {
          cursor = {
            updatedAt: cursorData.updatedAt,
            nmID: cursorData.nmID,
          }
        } else {
          // Если cursor отсутствует, прекращаем пагинацию
          console.log(`[ContentFetcher] Страница ${pageNumber}: cursor отсутствует, завершаем пагинацию`)
          break
        }

        pageNumber++

        // Задержка между запросами для соблюдения лимита API
        console.log(`[ContentFetcher] Ожидание ${this.API_RATE_LIMIT_MS} мс перед следующей страницей...`)
        await this.waitForRateLimit()
      }

      // Преобразуем Map в массив
      const cardsData = Array.from(cardsMap.values())

      if (cardsData.length === 0) {
        console.log(`[ContentFetcher] Загрузка завершена: данных для сохранения не найдено`)
        this.isFetching.value = false
        return 0
      }

      console.log(`[ContentFetcher] Обработка завершена: ${totalCards} исходных записей → ${cardsData.length} уникальных записей`)
      console.log(`[ContentFetcher] 💾 Сохранение ${cardsData.length} записей в БД...`)

      // Сохраняем в БД
      // bulkPut автоматически заменяет записи с существующими PK (overwrite)
      await db.product_cards.bulkPut(cardsData)

      console.log(`[ContentFetcher] ✅ Загрузка завершена успешно!`)
      console.log(`[ContentFetcher]   - Обработано страниц: ${pageNumber}`)
      console.log(`[ContentFetcher]   - Сохранено записей: ${cardsData.length}`)

      this.loadedCount.value = cardsData.length
      this.isFetching.value = false

      return cardsData.length
    } catch (error: any) {
      this.isFetching.value = false
      this.error.value = error.message || 'Неизвестная ошибка при загрузке карточек товаров'
      console.error(`[ContentFetcher] ❌ Ошибка при загрузке:`, error.message || error)
      throw error
    }
  }

  /**
   * Сброс состояния fetcher-а
   */
  reset(): void {
    this.loadedCount.value = 0
    this.isFetching.value = false
    this.error.value = null
  }
}

