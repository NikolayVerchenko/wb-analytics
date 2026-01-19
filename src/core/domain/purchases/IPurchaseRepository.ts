import type { IPurchase } from '../../../types/db'

/**
 * Интерфейс репозитория для работы с закупками
 */
export interface IPurchaseRepository {
  /**
   * Получить все закупки (отсортированные по дате, новые первыми)
   */
  getAll(): Promise<IPurchase[]>

  /**
   * Получить закупку по ID
   */
  getById(id: number): Promise<IPurchase | undefined>

  /**
   * Сохранить закупку (создать или обновить)
   * @returns ID сохранённой закупки
   */
  save(purchase: IPurchase): Promise<number>

  /**
   * Удалить закупку по ID
   */
  delete(id: number): Promise<void>

  /**
   * Найти закупки по диапазону дат
   */
  findByDateRange(dateFrom: string, dateTo: string): Promise<IPurchase[]>
}
