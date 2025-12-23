import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'
import type { ReportSaleRepository } from '@infrastructure/repositories/ReportSaleRepository'
import type { ReportReturnRepository } from '@infrastructure/repositories/ReportReturnRepository'
import { db } from '@infrastructure/db/database'
import type { LoggerService } from './LoggerService'

/**
 * Сервис для управления персистентностью данных (удаление/запись в sales и returns)
 * Отвечает за работу с флагом is_final и замену временных данных на финальные
 */
export class DataPersistenceService {
  constructor(
    private saleRepository: ReportSaleRepository,
    private returnRepository: ReportReturnRepository,
    private loggerService: LoggerService
  ) {}

  /**
   * Проверить, есть ли какие-либо данные в базе (продажи или возвраты)
   */
  async hasAnyData(): Promise<boolean> {
    try {
      // Используем getAll для проверки наличия данных
      const sales = await this.saleRepository.getAll()
      const returns = await this.returnRepository.getAll()
      return sales.length > 0 || returns.length > 0
    } catch (error) {
      console.error('Ошибка при проверке наличия данных:', error)
      return false
    }
  }

  /**
   * Удалить ВСЕ данные за период (и временные, и финальные)
   * Используется для полной очистки перед сохранением финальных weekly данных
   */
  async deleteAllDataForPeriod(startDate: string, endDate: string): Promise<void> {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]

    // Получаем все записи, где дата начинается с нужных строк или находится в диапазоне
    // Используем более широкий фильтр, чтобы захватить и "YYYY-MM-DD", и "YYYY-MM-DDThh:mm:ss"
    const allSales = await db.sales
      .where('rr_dt')
      .aboveOrEqual(start)
      .toArray()

    const salesToDelete = allSales.filter(s => {
      const date = s.rr_dt.split('T')[0]
      return date >= start && date <= end
    })

    if (salesToDelete.length > 0) {
      const idsToDelete = salesToDelete.map(s => s.id!).filter((id): id is number => id !== undefined)
      await db.sales.bulkDelete(idsToDelete)
      this.loggerService.add('info', `Удалено ${salesToDelete.length} записей продаж за период ${start} - ${end}`)
    }

    const allReturns = await db.returns
      .where('rr_dt')
      .aboveOrEqual(start)
      .toArray()

    const returnsToDelete = allReturns.filter(r => {
      const date = r.rr_dt.split('T')[0]
      return date >= start && date <= end
    })

    if (returnsToDelete.length > 0) {
      const idsToDelete = returnsToDelete.map(r => r.id!).filter((id): id is number => id !== undefined)
      await db.returns.bulkDelete(idsToDelete)
      this.loggerService.add('info', `Удалено ${returnsToDelete.length} записей возвратов за период ${start} - ${end}`)
    }
  }

  /**
   * Удалить все временные (is_final = false или undefined) записи за указанный период
   */
  async deleteTemporaryDataForPeriod(startDate: string, endDate: string): Promise<void> {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]

    const allSales = await db.sales
      .where('rr_dt')
      .aboveOrEqual(start)
      .toArray()

    const tempSales = allSales.filter(sale => {
      const date = sale.rr_dt.split('T')[0]
      const isWithinRange = date >= start && date <= end
      const isNotFinal = sale.is_final === false || sale.is_final === undefined
      return isWithinRange && isNotFinal
    })

    if (tempSales.length > 0) {
      const idsToDelete = tempSales.map(s => s.id!).filter((id): id is number => id !== undefined)
      await db.sales.bulkDelete(idsToDelete)
      this.loggerService.add('info', `Удалено ${tempSales.length} временных записей продаж за период ${start} - ${end}`)
    }

    const allReturns = await db.returns
      .where('rr_dt')
      .aboveOrEqual(start)
      .toArray()

    const tempReturns = allReturns.filter(ret => {
      const date = ret.rr_dt.split('T')[0]
      const isWithinRange = date >= start && date <= end
      const isNotFinal = ret.is_final === false || ret.is_final === undefined
      return isWithinRange && isNotFinal
    })

    if (tempReturns.length > 0) {
      const idsToDelete = tempReturns.map(r => r.id!).filter((id): id is number => id !== undefined)
      await db.returns.bulkDelete(idsToDelete)
      this.loggerService.add('info', `Удалено ${tempReturns.length} временных записей возвратов за период ${start} - ${end}`)
    }
  }

  /**
   * Сохранить финальные данные (is_final = true) за период
   */
  async saveFinalData(
    sales: ReportSale[],
    returns: ReportReturn[],
    periodDisplay: string
  ): Promise<void> {
    // Устанавливаем is_final = true для всех записей
    const finalSales = sales.map(sale => ({ ...sale, is_final: true }))
    const finalReturns = returns.map(ret => ({ ...ret, is_final: true }))

    if (finalSales.length > 0) {
      await this.saleRepository.createMany(finalSales)
      this.loggerService.add('success', `Сохранено ${finalSales.length} финальных записей продаж за ${periodDisplay}`)
    }

    if (finalReturns.length > 0) {
      await this.returnRepository.createMany(finalReturns)
      this.loggerService.add('success', `Сохранено ${finalReturns.length} финальных записей возвратов за ${periodDisplay}`)
    }
  }

  /**
   * Сохранить временные данные (is_final = false) за период (для Daily синхронизации)
   * Сначала удаляет существующие временные данные за этот период (санитарная очистка)
   */
  async saveTemporaryData(
    sales: ReportSale[],
    returns: ReportReturn[],
    periodDisplay: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    // Санитарная очистка: удаляем существующие временные данные за этот период
    if (startDate && endDate) {
      await this.deleteTemporaryDataForPeriod(startDate, endDate)
    }

    // Устанавливаем is_final = false для всех записей
    const tempSales = sales.map(sale => ({ ...sale, is_final: false }))
    const tempReturns = returns.map(ret => ({ ...ret, is_final: false }))

    if (tempSales.length > 0) {
      await this.saleRepository.createMany(tempSales)
      this.loggerService.add('info', `Сохранено ${tempSales.length} временных записей продаж за ${periodDisplay}`)
    }

    if (tempReturns.length > 0) {
      await this.returnRepository.createMany(tempReturns)
      this.loggerService.add('info', `Сохранено ${tempReturns.length} временных записей возвратов за ${periodDisplay}`)
    }
  }

  /**
   * Заменить временные данные на финальные за период (Daily -> Weekly переход)
   * Включает санитарную очистку: удаляет все нефинальные данные за период перед сохранением
   */
  async replaceTemporaryWithFinal(
    sales: ReportSale[],
    returns: ReportReturn[],
    startDate: string,
    endDate: string,
    periodDisplay: string,
    weekId?: string
  ): Promise<void> {
    // Получаем количество временных записей перед удалением для логирования
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const allSales = await db.sales
      .where('rr_dt')
      .between(start, end, true, true)
      .toArray()
    const tempSalesCount = allSales.filter(s => s.is_final === false || s.is_final === undefined).length
    
    const allReturns = await db.returns
      .where('rr_dt')
      .between(start, end, true, true)
      .toArray()
    const tempReturnsCount = allReturns.filter(r => r.is_final === false || r.is_final === undefined).length
    
    this.loggerService.add('info', `Замена временных данных на финальные за ${periodDisplay}`)
    
    // Санитарная очистка: удаляем все временные данные за период
    await this.deleteTemporaryDataForPeriod(startDate, endDate)
    
    // Логируем информацию о замене
    if (tempSalesCount > 0 || tempReturnsCount > 0) {
      const periodLabel = weekId ? `Неделя ${weekId}` : `Период ${periodDisplay}`
      this.loggerService.add('info', `${periodLabel}: Дневные данные удалены (${tempSalesCount} продаж, ${tempReturnsCount} возвратов), записан финальный недельный отчет`)
    }
    
    // Затем сохраняем финальные данные
    await this.saveFinalData(sales, returns, periodDisplay)
  }

  /**
   * Атомарное сохранение данных с обновлением sync_registry в рамках одной транзакции
   * Гарантирует целостность данных: либо все сохраняется, либо ничего
   */
  async saveDataAtomically(
    sales: ReportSale[],
    returns: ReportReturn[],
    periodDisplay: string,
    updateRegistry: () => Promise<void>,
    options: {
      isFinal?: boolean
      startDate?: string
      endDate?: string
      deleteTemporaryFirst?: boolean
    } = {}
  ): Promise<void> {
    const { isFinal = false, startDate, endDate, deleteTemporaryFirst = false } = options

    // Используем транзакцию Dexie для атомарности всех операций
    await db.transaction('rw', db.sales, db.returns, db.syncRegistry, async () => {
      // Санитарная очистка: удаляем существующие данные
      if (deleteTemporaryFirst && startDate && endDate) {
        if (isFinal) {
          // Для финальных данных удаляем ВСЕ данные за период (и временные, и финальные)
          // чтобы избежать дублирования и суммирования со старыми финальными данными
          await this.deleteAllDataForPeriod(startDate, endDate)
        } else {
          // Для временных данных удаляем только временные
          await this.deleteTemporaryDataForPeriod(startDate, endDate)
        }
      }

      // Сохраняем данные
      if (isFinal) {
        const finalSales = sales.map(sale => ({ ...sale, is_final: true }))
        const finalReturns = returns.map(ret => ({ ...ret, is_final: true }))

        if (finalSales.length > 0) {
          await this.saleRepository.createMany(finalSales)
        }

        if (finalReturns.length > 0) {
          await this.returnRepository.createMany(finalReturns)
        }
      } else {
        const tempSales = sales.map(sale => ({ ...sale, is_final: false }))
        const tempReturns = returns.map(ret => ({ ...ret, is_final: false }))

        if (tempSales.length > 0) {
          await this.saleRepository.createMany(tempSales)
        }

        if (tempReturns.length > 0) {
          await this.returnRepository.createMany(tempReturns)
        }
      }

      // Обновляем sync_registry только после успешного сохранения всех данных
      // Если что-то пойдет не так выше, транзакция откатится и sync_registry не обновится
      await updateRegistry()
    })

    // Подсчитываем количество продаж и возвратов как сумму quantity
    const totalSalesQuantity = sales.reduce((sum, s) => sum + (s.quantity || 0), 0)
    const totalReturnsQuantity = returns.reduce((sum, r) => sum + (r.quantity || 0), 0)
    this.loggerService.add('success', `Атомарно сохранено: ${totalSalesQuantity} продаж (quantity), ${totalReturnsQuantity} возвратов (quantity) за ${periodDisplay}`)
  }
}
