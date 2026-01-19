import type { WBReportRow } from '../../../types/db'
import type { ISale, IReturn, ILogistics, IPenalty } from '../../../types/db'

/**
 * Форматирует дату в формат YYYY-MM-DD
 */
export const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr.substring(0, 10)
    }
    return date.toISOString().split('T')[0]
  } catch {
    return dateStr.substring(0, 10)
  }
}

/**
 * Генерирует Primary Key для финансовых записей
 * Формат: nm_id_rr_dt_ts_name
 */
export const generatePK = (item: WBReportRow): string => {
  const dt = formatDate(item.rr_dt)
  return `${item.nm_id}_${dt}_${item.ts_name || ''}`
}

/**
 * Преобразует запись API в запись для таблицы продаж
 */
export const mapToSale = (item: WBReportRow): ISale => {
  return {
    pk: generatePK(item),
    dt: formatDate(item.rr_dt),
    ni: item.nm_id,
    sa: item.sa_name,
    bc: item.brand_name,
    sj: item.subject_name,
    sz: item.ts_name,
    qt: item.quantity || 0,
    pv: item.retail_price || 0,
    pa: item.retail_amount || 0,
    pz: item.ppvz_for_pay || 0,
    gi_id: item.gi_id,
  }
}

/**
 * Преобразует запись API в запись для таблицы возвратов
 */
export const mapToReturn = (item: WBReportRow): IReturn => {
  return {
    pk: generatePK(item),
    dt: formatDate(item.rr_dt),
    ni: item.nm_id,
    sa: item.sa_name,
    bc: item.brand_name,
    sj: item.subject_name,
    sz: item.ts_name,
    qt: item.quantity || 0,
    pv: item.retail_price || 0,
    pa: item.retail_amount || 0,
    pz: item.ppvz_for_pay || 0,
  }
}

/**
 * Преобразует запись API в запись для таблицы логистики
 */
export const mapToLogistics = (item: WBReportRow): ILogistics => {
  return {
    pk: generatePK(item),
    dt: formatDate(item.rr_dt),
    ni: item.nm_id,
    sa: item.sa_name,
    bc: item.brand_name,
    sj: item.subject_name,
    sz: item.ts_name,
    dl: item.delivery_amount || 0,
    rt: item.return_amount || 0,
    dr: item.delivery_rub || 0,
  }
}

/**
 * Преобразует запись API в запись для таблицы штрафов
 */
export const mapToPenalty = (item: WBReportRow): IPenalty => {
  return {
    pk: generatePK(item),
    dt: formatDate(item.rr_dt),
    ni: item.nm_id,
    sa: item.sa_name,
    bc: item.brand_name,
    sj: item.subject_name,
    sz: item.ts_name,
    bt: item.bonus_type_name || '',
    pn: item.penalty || 0,
  }
}
