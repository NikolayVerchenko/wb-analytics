import Dexie, { Table } from 'dexie'
import type { Order } from '@core/domain/entities/Order'
import type { Expense } from '@core/domain/entities/Expense'
import type { Storage } from '@core/domain/entities/Storage'
import type { Acceptance } from '@core/domain/entities/Acceptance'
import type { Product } from '@core/domain/entities/Product'
import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'
import type { SyncLog } from '@core/domain/entities/SyncLog'
import type { SyncRegistryEntry } from '@core/domain/entities/SyncRegistryEntry'
import type { PurchaseOrder } from '@core/domain/entities/PurchaseOrder'
import type { PurchaseItem } from '@core/domain/entities/PurchaseItem'
import type { FixedUnitCost } from '@core/domain/entities/FixedUnitCost'

export class WbDatabase extends Dexie {
  orders!: Table<Order, number>
  advExpenses!: Table<Expense, number>
  storage!: Table<Storage, number>
  acceptance!: Table<Acceptance, number>
  products!: Table<Product, number>
  // Финансовые отчеты (основные таблицы)
  sales!: Table<ReportSale, number>
  returns!: Table<ReportReturn, number>
  syncLogs!: Table<SyncLog, number>
  syncRegistry!: Table<SyncRegistryEntry, number>
  purchaseOrders!: Table<PurchaseOrder, number>
  purchaseItems!: Table<PurchaseItem, number>
  fixedUnitCosts!: Table<FixedUnitCost, number>

  constructor() {
    super('WbAnalyticsDB')
    
    this.version(1).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      sales: '++id, date, lastChangeDate, nmId, saleID, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, supplierArticle, barcode, createdAt',
    })

    this.version(2).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      sales: '++id, date, lastChangeDate, nmId, saleID, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, supplierArticle, barcode, createdAt',
      reportSales: '++id, gi_id, nm_id, rr_dt',
      reportReturns: '++id, gi_id, nm_id, rr_dt',
      syncLogs: '++id, weekId, status',
    })

    this.version(3).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, supplierArticle, barcode, createdAt',
      sales: '++id, gi_id, nm_id, rr_dt',
      returns: '++id, gi_id, nm_id, rr_dt',
      syncLogs: '++id, weekId, status',
    }).upgrade(async (tx) => {
      // Очищаем старые данные sales (если они есть и имеют старую структуру)
      try {
        const oldSalesData = await tx.table('sales').toArray()
        if (oldSalesData.length > 0 && oldSalesData[0] && 'saleID' in oldSalesData[0]) {
          // Это старые данные, удаляем их
          await tx.table('sales').clear()
        }
      } catch (e) {
        console.warn('Migration warning:', e)
      }
      
      // Миграция данных из reportSales в sales
      try {
        const reportSalesData = await tx.table('reportSales').toArray()
        if (reportSalesData.length > 0) {
          await tx.table('sales').bulkAdd(reportSalesData)
        }
      } catch (e) {
        console.warn('Migration warning:', e)
      }
      
      // Миграция данных из reportReturns в returns
      try {
        const reportReturnsData = await tx.table('reportReturns').toArray()
        if (reportReturnsData.length > 0) {
          await tx.table('returns').bulkAdd(reportReturnsData)
        }
      } catch (e) {
        console.warn('Migration warning:', e)
      }
    })

    this.version(4).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, supplierArticle, barcode, createdAt',
      sales: '++id, gi_id, nm_id, rr_dt, is_final',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
    }).upgrade(async (tx) => {
      // Устанавливаем is_final = false для всех существующих записей
      const sales = await tx.table('sales').toArray()
      const returns = await tx.table('returns').toArray()
      
      const salesUpdates = sales.map(sale => ({ ...sale, is_final: false }))
      const returnsUpdates = returns.map(ret => ({ ...ret, is_final: false }))
      
      if (salesUpdates.length > 0) {
        await tx.table('sales').bulkPut(salesUpdates)
      }
      if (returnsUpdates.length > 0) {
        await tx.table('returns').bulkPut(returnsUpdates)
      }
    })

    this.version(5).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, supplierArticle, barcode, createdAt',
      sales: '++id, gi_id, nm_id, rr_dt, is_final, operation_type',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
    })
    // Версия 5: добавлено поле operation_type в sales (не требует миграции данных, поле опциональное)

    this.version(6).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, vendorCode, lastUpdated', // Обновленная схема для products
      sales: '++id, gi_id, nm_id, rr_dt, is_final, operation_type',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
    })
    // Версия 6: обновлена схема products с полями vendorCode, title, photo, sizes, lastUpdated

    this.version(7).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, vendorCode, lastUpdated, weight', // Добавлено поле weight
      sales: '++id, gi_id, nm_id, rr_dt, is_final, operation_type',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
      purchaseOrders: '++id, orderNumber, date, status', // Новая таблица для заказов на закупку
    }).upgrade(async (tx) => {
      // Устанавливаем weight = 0 для всех существующих товаров
      const products = await tx.table('products').toArray()
      const productsUpdates = products.map(product => ({ ...product, weight: product.weight || 0 }))
      if (productsUpdates.length > 0) {
        await tx.table('products').bulkPut(productsUpdates)
      }
    })
    // Версия 7: добавлено поле weight в products и создана таблица purchaseOrders

    this.version(8).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, vendorCode, lastUpdated, weight',
      sales: '++id, gi_id, nm_id, rr_dt, is_final, operation_type',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
      purchaseOrders: '++id, orderNumber, date, status',
      purchaseItems: '++id, orderId, nmId', // Таблица товаров в заказах на закупку
    })
    // Версия 8: создана таблица purchaseItems для товаров в заказах на закупку

    this.version(9).stores({
      orders: '++id, date, lastChangeDate, nmId, gNumber, srid',
      advExpenses: '++id, date, type, nmId',
      storage: '++id, lastChangeDate, nmId, warehouse, barcode',
      acceptance: '++id, date, lastChangeDate, nmId, barcode',
      products: '++id, nmId, vendorCode, lastUpdated, weight',
      sales: '++id, gi_id, nm_id, rr_dt, is_final, operation_type',
      returns: '++id, gi_id, nm_id, rr_dt, is_final',
      syncLogs: '++id, weekId, status',
      syncRegistry: '++id, [periodId+type], periodId, type, status, lastAttempt, nextRetryAt, isFinal',
      purchaseOrders: '++id, orderNumber, date, status',
      purchaseItems: '++id, orderId, nmId',
      fixedUnitCosts: '++id, [nmId+size], orderId, date', // Таблица зафиксированных себестоимостей
    })
    // Версия 9: создана таблица fixedUnitCosts для зафиксированных себестоимостей
  }
}

export const db = new WbDatabase()
