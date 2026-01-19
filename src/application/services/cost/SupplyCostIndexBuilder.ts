/**
 * Построение индексов поставок для быстрого поиска себестоимости
 */

import type { ISupply } from '@/types/db'
import { normalizeSize, makeItemKey } from './costKey'

/**
 * Bucket для одной поставки: содержит ключи товаров и их себестоимость
 */
export interface SupplyBucket {
  /** Ключи всех товаров в поставке (даже если cost пустой) */
  existsKeys: Set<string>
  /** Себестоимость товаров, где cost задан и является числом */
  costByKey: Map<string, number>
}

/**
 * Индекс поставок для быстрого поиска по supplyID
 */
export interface SupplyIndex {
  bySupplyId: Map<number, SupplyBucket>
}

/**
 * Глобальный индекс для APPROX режима: поиск по nmID|size во всех поставках
 */
export interface ApproxIndex {
  /** Ключ: nmID|size, Значение: массив поставок с этим товаром и его себестоимостью */
  byItemKey: Map<string, Array<{ supplyId: number; date: string; cost: number }>>
}

/**
 * Строит индекс поставок для быстрого поиска себестоимости
 * 
 * @param supplies - Массив поставок
 * @returns Индекс поставок
 */
export function buildSupplyIndex(supplies: ISupply[]): SupplyIndex {
  const bySupplyId = new Map<number, SupplyBucket>()

  for (const supply of supplies) {
    const bucket: SupplyBucket = {
      existsKeys: new Set<string>(),
      costByKey: new Map<string, number>(),
    }

    for (const item of supply.items) {
      // Нормализуем techSize перед построением ключа
      const normalizedSize = normalizeSize(item.techSize)
      const key = makeItemKey(item.nmID, normalizedSize)

      // Всегда добавляем ключ в existsKeys (даже если cost пустой)
      bucket.existsKeys.add(key)

      // Добавляем в costByKey только если cost задан, является числом и > 0
      if (
        item.cost !== undefined &&
        item.cost !== null &&
        typeof item.cost === 'number' &&
        Number.isFinite(item.cost) &&
        item.cost > 0
      ) {
        bucket.costByKey.set(key, item.cost)
      }
    }

    bySupplyId.set(supply.supplyID, bucket)
  }

  return { bySupplyId }
}

/**
 * Строит глобальный индекс для APPROX режима (поиск по nmID|size во всех поставках)
 * 
 * @param supplies - Массив поставок
 * @returns Глобальный индекс для APPROX режима
 */
export function buildApproxIndex(supplies: ISupply[]): ApproxIndex {
  const byItemKey = new Map<string, Array<{ supplyId: number; date: string; cost: number }>>()

  for (const supply of supplies) {
    // Используем factDate если есть, иначе createDate
    const date = supply.factDate || supply.createDate

    for (const item of supply.items) {
      // Пропускаем товары без себестоимости
      if (
        item.cost === undefined ||
        item.cost === null ||
        typeof item.cost !== 'number' ||
        !Number.isFinite(item.cost) ||
        item.cost <= 0
      ) {
        continue
      }

      // Нормализуем techSize и создаем ключ
      const normalizedSize = normalizeSize(item.techSize)
      const key = makeItemKey(item.nmID, normalizedSize)

      // Добавляем в индекс
      if (!byItemKey.has(key)) {
        byItemKey.set(key, [])
      }
      byItemKey.get(key)!.push({
        supplyId: supply.supplyID,
        date,
        cost: item.cost,
      })
    }
  }

  return { byItemKey }
}
