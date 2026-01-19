import type { ISale } from '@core/domain/entities/SaleCompact'

/**
 * Интерфейс строки отчета из API WB (v5 reportDetailByPeriod)
 */
export interface WBReportRow {
  realizationreport_id?: number
  suppliercontract_code?: string
  rrd_id: number
  gi_id: number
  subject_name: string
  nm_id: number
  brand_name: string
  sa_name: string
  ts_name: string
  barcode: string
  doc_type_name: string
  quantity: number
  retail_price: number
  retail_amount: number
  sale_percent: number
  commission_percent: number
  office_name: string
  supplier_oper_name: string
  order_dt: string
  sale_dt: string
  rr_dt: string
  shk_id: number
  retail_price_withdisc_rub: number
  delivery_amount: number
  return_amount: number
  delivery_rub: number
  gi_box_type_name: string
  product_discount_for_report: number
  supplier_promo: number
  rr_id?: number
  rp_id?: number
  ppvz_spp_prc?: number
  ppvz_kvw_prc_base?: number
  ppvz_kvw_prc?: number
  ppvz_sales_commission?: number
  ppvz_for_pay?: number
  ppvz_reward?: number
  acquiring_fee?: number
  acquiring_bank?: string
  ppvz_vw?: number
  ppvz_vw_nds?: number
  ppvz_office_id?: number
  ppvz_office_name?: string
  ppvz_supplier_id?: number
  ppvz_supplier_name?: string
  ppvz_inn?: string
  declaration_number?: string
  sticker_id?: string
  site_country?: string
  penalty?: number
  additional_payment?: number
  kiz?: string
  srid?: string
  [key: string]: any // Для дополнительных полей
}

/**
 * Сервис для трансформации данных отчетов WB API в компактный формат ISale
 */
export class ReportTransformService {
  /**
   * Трансформирует строку отчета из API в компактный формат ISale
   * @param row Строка отчета из API
   * @returns ISale или null, если строка должна быть пропущена
   */
  transformReportRow(row: WBReportRow): ISale | null {
    // Фильтр: сохраняем только "Продажа" и "Логистика"
    // Пропускаем все остальные операции (возвраты, корректировки, штрафы и т.д.)
    const operName = row.supplier_oper_name?.trim() || ''
    if (operName !== 'Продажа' && operName !== 'Логистика') {
      return null
    }

    // Формируем первичный ключ: ${rr_dt}_${nm_id}_${ts_name}_${rrd_id}
    const dt = this.formatDate(row.rr_dt)
    const pk = `${dt}_${row.nm_id}_${row.ts_name || ''}_${row.rrd_id || 0}`

    // Трансформация данных в компактный формат
    const sale: ISale = {
      pk,
      dt, // Дата (rr_dt)
      ni: row.nm_id, // Артикул WB
      sz: row.ts_name || undefined, // Размер
      sa: row.sa_name || undefined, // Артикул продавца
      sj: row.subject_name || undefined, // Предмет
      bc: row.brand_name || undefined, // Бренд
      
      // Финансовые показатели
      pv: row.retail_price || undefined, // Цена продажи
      pa: row.retail_amount || undefined, // Сумма продажи
      tr: row.quantity || undefined, // Количество
      
      // Доставка и возвраты
      dl: row.delivery_rub || undefined, // Доставка
      rt: row.return_amount || undefined, // Возврат
      lg: row.delivery_amount || undefined, // Логистика
      
      // Дополнительные показатели
      pz: row.ppvz_for_pay || undefined, // К выплате
      pn: row.penalty || undefined, // Штраф
      ap: row.additional_payment || undefined, // Дополнительная оплата
      
      // Внутренние поля
      gi_id: row.gi_id || undefined, // gi_id
    }

    // Логируем для отладки, если gi_id отсутствует
    if (!sale.gi_id && row.gi_id) {
      console.warn(`[ReportTransformService] gi_id не сохранен: row.gi_id=${row.gi_id}, sale.gi_id=${sale.gi_id}`)
    }

    return sale
  }

  /**
   * Трансформирует массив строк отчета
   * @param rows Массив строк отчета
   * @returns Массив ISale (только "Продажа" и "Логистика")
   */
  transformReportRows(rows: WBReportRow[]): ISale[] {
    const result: ISale[] = []
    
    for (const row of rows) {
      const transformed = this.transformReportRow(row)
      if (transformed) {
        result.push(transformed)
      }
    }
    
    return result
  }

  /**
   * Форматирует дату в формат YYYY-MM-DD
   * @param dateStr Дата в формате ISO или другом формате
   * @returns Дата в формате YYYY-MM-DD
   */
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        // Если не удалось распарсить, возвращаем исходную строку (обрезанную до 10 символов)
        return dateStr.substring(0, 10)
      }
      return date.toISOString().split('T')[0]
    } catch (error) {
      // В случае ошибки возвращаем исходную строку (обрезанную до 10 символов)
      return dateStr.substring(0, 10)
    }
  }
}

