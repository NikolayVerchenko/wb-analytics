import { db } from '../db/database'
import type { Product } from '@core/domain/entities/Product'
import type { IProductRepository } from '@core/domain/repositories/IWBRepository'

export class ProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    return await db.products.toArray()
  }

  async getById(id: number): Promise<Product | undefined> {
    return await db.products.get(id)
  }

  async getByNmId(nmId: number): Promise<Product | undefined> {
    return await db.products.where('nmId').equals(nmId).first()
  }

  async create(product: Product): Promise<number> {
    return await db.products.add(product)
  }

  async createMany(products: Product[]): Promise<number> {
    return await db.products.bulkAdd(products)
  }

  async update(product: Product): Promise<void> {
    if (product.id) {
      await db.products.update(product.id, product)
    }
  }

  async upsert(product: Product): Promise<void> {
    // Если товар с таким nmId уже существует, обновляем его
    const existing = await this.getByNmId(product.nmId)
    if (existing) {
      // Обновляем существующий товар
      await db.products.update(existing.id!, { ...product, id: existing.id })
    } else {
      // Создаем новый товар
      await db.products.add(product)
    }
  }

  async upsertMany(products: Product[]): Promise<void> {
    // Для правильного upsert нужно получить существующие записи и обновить их id
    const nmIds = products.map(p => p.nmId)
    const existingProducts = await db.products.where('nmId').anyOf(nmIds).toArray()
    const existingMap = new Map(existingProducts.map(p => [p.nmId, p]))
    
    // Разделяем на новые и обновляемые записи
    const toUpdate: Product[] = []
    const toAdd: Product[] = []
    
    for (const product of products) {
      const existing = existingMap.get(product.nmId)
      if (existing && existing.id) {
        // Для существующих записей создаем полностью новый объект
        // Важно: явно указываем все поля, чтобы гарантировать правильную структуру
        // и избежать проблем с неправильными типами данных в старых записях
        const updated: Product = {
          id: existing.id, // Сохраняем существующий id
          nmId: product.nmId,
          vendorCode: product.vendorCode,
          title: product.title,
          brand: product.brand,
          photo: typeof product.photo === 'string' ? product.photo : undefined, // Гарантируем, что photo - строка
          sizes: product.sizes,
          category: product.category,
          subject: product.subject,
          supplierArticle: product.supplierArticle,
          barcode: product.barcode,
          techSize: product.techSize,
          weight: typeof product.weight === 'number' ? product.weight : (product.weight || 0), // Гарантируем, что weight - число
          createdAt: product.createdAt,
          lastUpdated: product.lastUpdated
        }
        toUpdate.push(updated)
      } else {
        // Новая запись - также нормализуем данные
        const normalized: Product = {
          ...product,
          photo: typeof product.photo === 'string' ? product.photo : undefined,
          weight: typeof product.weight === 'number' ? product.weight : (product.weight || 0)
        }
        toAdd.push(normalized)
      }
    }
    
    // Для обновления используем bulkPut, который полностью заменяет объект по id
    // Это более надежно, чем update, так как полностью заменяет запись
    if (toUpdate.length > 0) {
      await db.products.bulkPut(toUpdate)
    }
    
    // Добавляем новые записи
    if (toAdd.length > 0) {
      await db.products.bulkAdd(toAdd)
    }
  }

  async getByVendorCode(vendorCode: string): Promise<Product[]> {
    if (!vendorCode) return []
    return await db.products.where('vendorCode').equals(vendorCode).toArray()
  }

  async delete(id: number): Promise<void> {
    await db.products.delete(id)
  }

  async clear(): Promise<void> {
    await db.products.clear()
  }
}
