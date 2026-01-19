import type { ILoadedPeriod } from '../../types/db'

/**
 * Репозиторий для работы с загруженными периодами данных
 * 
 * Используется для фиксации того, по какие даты уже загружены данные в базу.
 * Позволяет проверять загруженные периоды и отслеживать прогресс синхронизации.
 */
export interface LoadedPeriodRepository {
  /**
   * Добавить загруженный период
   * @param period Период для сохранения (без id)
   * @returns ID созданной записи
   */
  add(period: Omit<ILoadedPeriod, 'id'>): Promise<number>
  
  /**
   * Проверить, загружен ли период
   * @param dataset Ключ датасета
   * @param from Начало периода (ISO дата: YYYY-MM-DD)
   * @param to Конец периода (ISO дата: YYYY-MM-DD)
   * @returns true, если период загружен
   */
  isLoaded(dataset: string, from: string, to: string): Promise<boolean>
  
  /**
   * Получить все загруженные периоды для датасета
   * @param dataset Ключ датасета
   * @returns Массив загруженных периодов
   */
  getByDataset(dataset: string): Promise<ILoadedPeriod[]>
  
  /**
   * Получить загруженные периоды в диапазоне дат
   * @param dataset Ключ датасета
   * @param from Начало диапазона (ISO дата: YYYY-MM-DD)
   * @param to Конец диапазона (ISO дата: YYYY-MM-DD)
   * @returns Массив загруженных периодов в указанном диапазоне
   */
  getByDateRange(dataset: string, from: string, to: string): Promise<ILoadedPeriod[]>
  
  /**
   * Удалить период (для перезагрузки)
   * @param id ID записи для удаления
   */
  remove(id: number): Promise<void>
  
  /**
   * Удалить все периоды для датасета (для полной перезагрузки)
   * @param dataset Ключ датасета
   */
  removeByDataset(dataset: string): Promise<void>
}
