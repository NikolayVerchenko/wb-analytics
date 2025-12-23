import type { ReportSale } from '@core/domain/entities/ReportSale'
import type { ReportReturn } from '@core/domain/entities/ReportReturn'

export interface RawReportItem {
  gi_id: number
  subject_name: string
  nm_id: number
  brand_name: string
  sa_name: string
  ts_name: string
  quantity: number
  retail_price: number
  retail_amount: number
  rr_dt: string
  delivery_amount: number
  return_amount: number
  delivery_rub: number
  ppvz_for_pay: number
  bonus_type_name: string
  penalty: number
  additional_payment: number
  supplier_oper_name: string
  storage_fee?: number // Штраф за хранение
  rrd_id?: number
}

export class ReportDataMapper {
  /**
   * Преобразует сырой ответ API в сущности ReportSale и ReportReturn
   * Фильтрация:
   * - Если supplier_oper_name НЕ равно "Продажа" -> записывай в returns
   * - Если supplier_oper_name НЕ равно "Возврат" -> записывай в sales
   */
  mapToEntities(rawData: RawReportItem[]): {
    sales: ReportSale[]
    returns: ReportReturn[]
  } {
    const sales: ReportSale[] = []
    const returns: ReportReturn[] = []

    for (const item of rawData) {
      const baseEntity = {
        gi_id: item.gi_id,
        subject_name: item.subject_name,
        nm_id: item.nm_id,
        brand_name: item.brand_name,
        sa_name: item.sa_name,
        ts_name: item.ts_name,
        quantity: item.quantity,
        retail_price: item.retail_price,
        retail_amount: item.retail_amount,
        rr_dt: item.rr_dt,
        delivery_amount: item.delivery_amount,
        return_amount: item.return_amount,
        delivery_rub: item.delivery_rub,
        ppvz_for_pay: item.ppvz_for_pay,
        bonus_type_name: item.bonus_type_name,
        penalty: item.penalty,
        additional_payment: item.additional_payment,
      }

      // Если НЕ "Продажа" -> в returns
      if (item.supplier_oper_name !== 'Продажа') {
        returns.push(baseEntity as ReportReturn)
      }

      // Если НЕ "Возврат" -> в sales
      if (item.supplier_oper_name !== 'Возврат') {
        sales.push(baseEntity as ReportSale)
      }
    }

    return { sales, returns }
  }
}
