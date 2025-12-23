import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'

export interface VendorCodeInfo {
  sa_name: string
  brand_name: string
}

export class VendorCodeService {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository
  ) {}

  /**
   * Получает все уникальные артикулы продавца (sa_name) из таблиц sales и returns
   * @returns Отсортированный массив объектов с артикулом и брендом
   */
  async getUniqueVendorCodes(): Promise<VendorCodeInfo[]> {
    // Получаем все продажи
    const sales = await this.saleRepository.getAll()
    
    // Получаем все возвраты
    const returns = await this.returnRepository.getAll()

    // Создаем Map для уникальных артикулов (ключ: sa_name, значение: brand_name)
    const vendorCodesMap = new Map<string, string>()
    
    // Добавляем артикулы из продаж
    for (const sale of sales) {
      if (sale.sa_name && sale.sa_name.trim() !== '') {
        // Если артикул уже есть, берем бренд из первой встреченной записи (или можно брать последний)
        if (!vendorCodesMap.has(sale.sa_name)) {
          vendorCodesMap.set(sale.sa_name, sale.brand_name || '')
        }
      }
    }
    
    // Добавляем артикулы из возвратов (если их еще нет в Map)
    for (const ret of returns) {
      if (ret.sa_name && ret.sa_name.trim() !== '') {
        if (!vendorCodesMap.has(ret.sa_name)) {
          vendorCodesMap.set(ret.sa_name, ret.brand_name || '')
        }
      }
    }
    
    // Преобразуем Map в массив объектов и сортируем по sa_name
    const vendorCodes: VendorCodeInfo[] = Array.from(vendorCodesMap.entries()).map(([sa_name, brand_name]) => ({
      sa_name,
      brand_name,
    }))
    
    return vendorCodes.sort((a, b) => a.sa_name.localeCompare(b.sa_name))
  }
}
