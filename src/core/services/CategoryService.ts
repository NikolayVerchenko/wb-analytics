import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'

export class CategoryService {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository
  ) {}

  /**
   * Получает все уникальные категории (subject_name) из таблиц sales и returns
   * @returns Отсортированный список уникальных категорий
   */
  async getUniqueCategories(): Promise<string[]> {
    // Получаем все продажи
    const sales = await this.saleRepository.getAll()
    
    // Получаем все возвраты
    const returns = await this.returnRepository.getAll()

    // Создаем Set для уникальных категорий
    const categories = new Set<string>()
    
    // Добавляем категории из продаж
    for (const sale of sales) {
      if (sale.subject_name && sale.subject_name.trim() !== '') {
        categories.add(sale.subject_name)
      }
    }
    
    // Добавляем категории из возвратов
    for (const ret of returns) {
      if (ret.subject_name && ret.subject_name.trim() !== '') {
        categories.add(ret.subject_name)
      }
    }
    
    // Возвращаем отсортированный список
    return Array.from(categories).sort()
  }
}
