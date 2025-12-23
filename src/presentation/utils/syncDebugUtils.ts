import { db } from '@infrastructure/db/database'
import type { SyncRegistryEntry } from '@core/domain/entities/SyncRegistryEntry'

/**
 * Утилиты для отладки и проверки системы синхронизации
 */
export class SyncDebugUtils {
  /**
   * Проверить состояние реестра синхронизации
   */
  static async checkSyncRegistry(): Promise<void> {
    console.group('🔍 Проверка реестра синхронизации (sync_registry)')
    
    try {
      const allEntries = await db.syncRegistry.toArray()
      console.log(`Всего записей в реестре: ${allEntries.length}`)
      
      if (allEntries.length === 0) {
        console.warn('⚠️ Реестр пуст. Это нормально для первого запуска.')
        console.groupEnd()
        return
      }

      // Группируем по статусам
      const byStatus = allEntries.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log('📊 По статусам:', byStatus)

      // Группируем по типам
      const byType = allEntries.reduce((acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log('📊 По типам:', byType)

      // Показываем последние 10 записей
      const recent = allEntries
        .sort((a, b) => b.lastAttempt - a.lastAttempt)
        .slice(0, 10)

      console.log('📋 Последние 10 записей:')
      recent.forEach(entry => {
        const date = new Date(entry.lastAttempt).toLocaleString('ru-RU')
        const nextRetry = entry.nextRetryAt ? new Date(entry.nextRetryAt).toLocaleString('ru-RU') : '-'
        console.log(`  - ${entry.periodId} [${entry.type}] ${entry.status}${entry.isFinal ? ' ✓ финальный' : ''} | Попытка: ${date} | Повтор: ${nextRetry}`)
      })

      // Показываем записи, готовые к повтору
      const now = Date.now()
      const readyForRetry = allEntries.filter(
        e => e.status === 'waiting' && e.nextRetryAt && e.nextRetryAt <= now
      )

      if (readyForRetry.length > 0) {
        console.log(`⏰ Готово к повтору: ${readyForRetry.length} записей`)
        readyForRetry.forEach(entry => {
          console.log(`  - ${entry.periodId} [${entry.type}]`)
        })
      }
    } catch (error) {
      console.error('❌ Ошибка при проверке реестра:', error)
    }

    console.groupEnd()
  }

  /**
   * Проверить данные sales и returns с флагами is_final
   */
  static async checkSalesAndReturns(): Promise<void> {
    console.group('🔍 Проверка данных sales и returns')

    try {
      const allSales = await db.sales.toArray()
      const allReturns = await db.returns.toArray()

      console.log(`Всего продаж: ${allSales.length}`)
      console.log(`Всего возвратов: ${allReturns.length}`)

      // Группируем по is_final
      const salesByFinal = {
        final: allSales.filter(s => s.is_final === true).length,
        temp: allSales.filter(s => s.is_final === false || s.is_final === undefined).length,
      }

      const returnsByFinal = {
        final: allReturns.filter(r => r.is_final === true).length,
        temp: allReturns.filter(r => r.is_final === false || r.is_final === undefined).length,
      }

      console.log('📊 Продажи по is_final:', salesByFinal)
      console.log('📊 Возвраты по is_final:', returnsByFinal)

      // Группируем по датам (последние 10 дней)
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const tenDaysAgo = new Date(today)
      tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10)

      const recentSales = allSales.filter(s => {
        const date = new Date(s.rr_dt.split('T')[0])
        return date >= tenDaysAgo
      })

      const recentReturns = allReturns.filter(r => {
        const date = new Date(r.rr_dt.split('T')[0])
        return date >= tenDaysAgo
      })

      console.log(`📅 Данные за последние 10 дней: продаж=${recentSales.length}, возвратов=${recentReturns.length}`)

      // Группируем по датам
      const salesByDate = new Map<string, { final: number, temp: number }>()
      const returnsByDate = new Map<string, { final: number, temp: number }>()

      recentSales.forEach(sale => {
        const date = sale.rr_dt.split('T')[0]
        const group = salesByDate.get(date) || { final: 0, temp: 0 }
        if (sale.is_final === true) {
          group.final++
        } else {
          group.temp++
        }
        salesByDate.set(date, group)
      })

      recentReturns.forEach(ret => {
        const date = ret.rr_dt.split('T')[0]
        const group = returnsByDate.get(date) || { final: 0, temp: 0 }
        if (ret.is_final === true) {
          group.final++
        } else {
          group.temp++
        }
        returnsByDate.set(date, group)
      })

      console.log('📅 Детализация по датам (последние 10 дней):')
      const sortedDates = Array.from(salesByDate.keys()).sort().reverse().slice(0, 10)
      sortedDates.forEach(date => {
        const sales = salesByDate.get(date) || { final: 0, temp: 0 }
        const returns = returnsByDate.get(date) || { final: 0, temp: 0 }
        console.log(`  ${date}: продажи [фин:${sales.final} врем:${sales.temp}] | возвраты [фин:${returns.final} врем:${returns.temp}]`)
      })

    } catch (error) {
      console.error('❌ Ошибка при проверке данных:', error)
    }

    console.groupEnd()
  }

  /**
   * Проверить структуру базы данных
   */
  static async checkDatabaseStructure(): Promise<void> {
    console.group('🔍 Проверка структуры базы данных')

    try {
      // Проверяем наличие таблиц
      const tables = ['sales', 'returns', 'syncRegistry', 'syncLogs']
      
      for (const tableName of tables) {
        try {
          const count = await (db as any)[tableName].count()
          console.log(`✓ Таблица ${tableName}: ${count} записей`)
        } catch (error) {
          console.error(`✗ Таблица ${tableName} не найдена или недоступна:`, error)
        }
      }

      // Проверяем индексы для syncRegistry
      try {
        const testEntry = await db.syncRegistry.limit(1).first()
        if (testEntry) {
          console.log('✓ Индексы syncRegistry работают')
        }
      } catch (error) {
        console.error('✗ Проблема с индексами syncRegistry:', error)
      }

      // Проверяем наличие поля is_final
      try {
        const testSale = await db.sales.limit(1).first()
        if (testSale) {
          if ('is_final' in testSale) {
            console.log('✓ Поле is_final присутствует в sales')
          } else {
            console.warn('⚠️ Поле is_final отсутствует в sales')
          }
        }
      } catch (error) {
        console.error('✗ Ошибка при проверке поля is_final:', error)
      }

    } catch (error) {
      console.error('❌ Ошибка при проверке структуры:', error)
    }

    console.groupEnd()
  }

  /**
   * Полная проверка системы синхронизации
   */
  static async fullCheck(): Promise<void> {
    console.log('🔍 === ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ СИНХРОНИЗАЦИИ ===\n')
    
    await this.checkDatabaseStructure()
    console.log('')
    await this.checkSyncRegistry()
    console.log('')
    await this.checkSalesAndReturns()
    
    console.log('\n✅ Проверка завершена')
  }

  /**
   * Очистить реестр синхронизации (для тестирования)
   */
  static async clearSyncRegistry(): Promise<void> {
    if (confirm('Вы уверены, что хотите очистить реестр синхронизации?')) {
      await db.syncRegistry.clear()
      console.log('✓ Реестр синхронизации очищен')
    }
  }
}

// Экспортируем в глобальную область для использования в консоли браузера
if (typeof window !== 'undefined') {
  (window as any).SyncDebug = SyncDebugUtils
  console.log('🔧 Утилиты отладки доступны через window.SyncDebug')
  console.log('   Используйте: SyncDebug.fullCheck()')
}
