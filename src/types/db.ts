/**
 * Интерфейсы для базы данных с короткими ключами
 * Оптимизировано для хранения в IndexedDB
 */

/**
 * Базовый интерфейс для всех финансовых записей
 */
export interface BaseFinanceRecord {
  pk: string // Primary Key: ${nm_id}_${rr_dt}_${ts_name}
  dt: string // Дата (rr_dt) - ISO string YYYY-MM-DD
  ni: number // Артикул WB (nm_id)
  sz?: string // Размер (ts_name)
  sa?: string // Артикул продавца (sa_name)
  bc?: string // Бренд (brand_name)
  sj?: string // Предмет (subject_name)
}

/**
 * Интерфейс для строки отчета из API WB (v5 reportDetailByPeriod)
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
  bonus_type_name?: string
  deduction?: number
  kiz?: string
  srid?: string
  [key: string]: any
}

/**
 * Компактный интерфейс для продаж
 */
export interface ISale extends BaseFinanceRecord {
  qt?: number // Количество (quantity)
  pv?: number // Цена продажи (retail_price)
  pa?: number // Сумма продажи (retail_amount)
  pz?: number // К выплате (ppvz_for_pay)
}

/**
 * Компактный интерфейс для возвратов
 */
export interface IReturn extends BaseFinanceRecord {
  qt?: number // Количество (quantity)
  pv?: number // Цена продажи (retail_price)
  pa?: number // Сумма продажи (retail_amount)
}

/**
 * Компактный интерфейс для логистики
 */
export interface ILogistics extends BaseFinanceRecord {
  dl?: number // Доставка (delivery_amount)
  rt?: number // Возврат (return_amount)
  dr?: number // Доставка в рублях (delivery_rub)
}

/**
 * Компактный интерфейс для штрафов
 */
export interface IPenalty extends BaseFinanceRecord {
  bt?: string // Тип бонуса (bonus_type_name)
  pn?: number // Штраф (penalty)
}

/**
 * Компактный интерфейс для удержаний
 */
export interface IDeduction extends BaseFinanceRecord {
  bt?: string // Тип бонуса (bonus_type_name)
  dd?: number // Удержание (deduction)
}

/**
 * Интерфейс для рекламных расходов
 * PK: ${nmId}_${date} (Артикул_Дата)
 */
export interface IAdvCost {
  pk: string // Primary Key: ${nmId}_${date}
  dt: string // Дата (YYYY-MM-DD)
  ni: number // Артикул WB (nmId)
  costs: number // Сумма рекламных расходов
}

/**
 * Интерфейс для стоимости приемки
 * PK: ${nmId}_${date} (Артикул_Дата)
 */
export interface IAcceptanceCost {
  pk: string // Primary Key: ${nmId}_${date}
  dt: string // Дата (YYYY-MM-DD)
  ni: number // Артикул WB (nmId)
  costs: number // Сумма стоимости приемки
}
