export interface ReportSale {
  id?: number
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
  is_final?: boolean // true для финальных данных из недельного отчета, false для временных дневных
  operation_type?: string // Тип операции (supplier_oper_name из API): "Продажа", "Сторно", "Штрафы" и т.д.
}
