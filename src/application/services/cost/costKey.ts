/**
 * Утилиты нормализации ключей для сопоставления себестоимости
 */

/**
 * Нормализует размер товара: trim + uppercase
 * Возвращает пустую строку если size пустой/undefined/null
 */
export function normalizeSize(size?: string | null): string {
  if (!size) return ''
  return String(size).trim().toUpperCase()
}

/**
 * Нормализует ID поставки или артикула: преобразует в число или null
 */
export function normalizeId(id: unknown): number | null {
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

/**
 * Создает ключ товара для поиска в поставке: "nmID|SIZE"
 * КРИТИЧНО: ОБЯЗАТЕЛЬНО использует normalizeSize(size) перед построением ключа
 * 
 * @example
 * makeItemKey(100, " s ") → "100|S" (не "100| s ")
 */
export function makeItemKey(nmID: number, size: string): string {
  const normalizedSize = normalizeSize(size)
  return `${nmID}|${normalizedSize}`
}

/**
 * Создает универсальный ключ продажи для lookup: "ni*dt*sz"
 * Используется для сопоставления результата матчинга с продажей
 * 
 * @param ni - Артикул WB
 * @param dt - Дата продажи (ISO string YYYY-MM-DD)
 * @param sz - Размер товара (будет нормализован)
 * @returns Ключ вида "100*2024-01-01*S"
 */
export function makeSaleKey(ni: number, dt: string, sz?: string | null): string {
  const normalizedSize = normalizeSize(sz)
  return `${ni}*${dt}*${normalizedSize}`
}
