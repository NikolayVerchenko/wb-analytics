/**
 * Компактный интерфейс для продаж с короткими ключами
 * Оптимизирован для хранения в IndexedDB
 */
export interface ISale {
  id?: number
  // Составной первичный ключ: ${dt}_${ni}_${sz}
  pk: string
  
  // Двухбуквенные ключи
  dt: string // Дата (rr_dt) - ISO string YYYY-MM-DD
  ni: number // Артикул WB (nm_id)
  sz?: string // Размер (ts_name)
  sa?: string // Артикул продавца (sa_name)
  sj?: string // Предмет (subject_name)
  bc?: string // Бренд (brand_name)
  
  // Финансовые показатели
  pv?: number // Цена продажи (retail_price)
  pa?: number // Сумма продажи (retail_amount)
  tr?: number // Количество (quantity)
  
  // Доставка и возвраты
  dl?: number // Доставка (delivery_rub)
  rt?: number // Возврат (return_amount)
  lg?: number // Логистика (delivery_amount)
  
  // Дополнительные поля
  fn?: boolean // Финальность (is_final)
  tp?: string // Тип операции (operation_type)
  
  // Дополнительные показатели
  dd?: number // Дополнительная доставка (delivery_amount)
  pz?: number // К выплате (ppvz_for_pay)
  pn?: number // Штраф (penalty)
  ap?: number // Дополнительная оплата (additional_payment)
  
  // Внутренние поля для связи
  gi_id?: number // gi_id (внутренний ID WB)
}

