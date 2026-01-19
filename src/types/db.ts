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
  gi_id?: number // ID поставки (gi_id из API)
}

/**
 * Компактный интерфейс для возвратов
 */
export interface IReturn extends BaseFinanceRecord {
  qt?: number // Количество (quantity)
  pv?: number // Цена продажи (retail_price)
  pa?: number // Сумма продажи (retail_amount)
  pz?: number // К выплате (ppvz_for_pay)
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
 * PK: ${nmID}_${shkCreateDate} (Артикул_Дата приёмки)
 */
export interface IAcceptanceCost {
  pk: string // Primary Key: ${nmID}_${shkCreateDate}
  dt: string // Дата приёмки (YYYY-MM-DD)
  ni: number // Артикул WB (nmID)
  costs: number // Сумма стоимости приемки
}

/**
 * Интерфейс для стоимости платного хранения
 * PK: ${date}_${nmId}_${size} (Дата_Артикул_Размер)
 */
export interface IStorageCost {
  pk: string // Primary Key: ${date}_${nmId}_${size}
  dt: string // Дата (YYYY-MM-DD)
  sj: string // Предмет (subject_name)
  bc: string // Бренд (brand_name)
  sa: string // Артикул продавца (sa_name)
  ni: number // Артикул WB (nmId)
  sz: string // Размер (size)
  sc: number // Сумма стоимости хранения (storage cost)
}

/**
 * Интерфейс для статистики заказов (Воронка продаж v3)
 * PK: ${dt}_${ni} (Дата начала периода_Артикул WB)
 */
export interface IProductOrder {
  pk: string // Primary Key: ${dt}_${ni}
  dt: string // Дата начала периода (YYYY-MM-DD)
  ni: number // Артикул WB (nmId)
  sa: string // Артикул продавца (vendorCode)
  bc: string // Бренд (brandName)
  sj: string // Название предмета (subjectName)
  oc: number // Заказали товаров, шт. (orderCount)
  os: number // Заказали на сумму (orderSum)
  vsc: number // Количество переходов в карточку товара (openCount)
  cc: number // Положили в корзину, шт. (cartCount)
  bc_cnt: number // Выкупили товаров, шт. (buyoutCount)
  bs: number // Выкупили на сумму (buyoutSum)
  cnc: number // Отменили товаров, шт. (cancelCount)
  cns: number // Отменили на сумму (cancelSum)
  fav: number // Добавили в Отложенные (addToWishlist)
}

/**
 * Интерфейс для карточек товаров (справочник)
 * PK: ${ni}_${sz} (Артикул WB_Размер)
 */
export interface IProductCard {
  pk: string // Primary Key: ${ni}_${sz}
  ni: number // Артикул WB (nmID)
  sz: string // Размер товара (techSize)
  sj: string // Название предмета (subjectName)
  sa: string // Артикул продавца (vendorCode)
  bc: string // Бренд (brand)
  title: string // Наименование товара (title)
  img: string // URL фото (photos[0].tm)
  dims: string // Габариты в формате "lengthxwidthxheight" (например, "55x40x15")
  weight: number // Вес товара с упаковкой, кг (weightBrutto)
}

/**
 * Интерфейс для остатков на складах
 * PK: ${ni}_${sz} (Артикул WB_Размер)
 */
export interface IWarehouseRemain {
  pk: string // Primary Key: ${ni}_${sz}
  bc: string // Бренд (brand)
  sj: string // Название предмета (subjectName)
  sa: string // Артикул продавца (vendorCode)
  ni: number // Артикул WB (nmId)
  sz: string // Размер товара (techSize)
  q_wh: number // Остатки на складах (quantity из "Всего находится на складах")
  q_way_cust: number // В пути до получателей (quantity из "В пути до получателей")
  q_way_wh: number // В пути возвраты на склад WB (quantity из "В пути возвраты на склад WB")
  details: string // JSON.stringify всего массива warehouses (для детального просмотра)
}

/**
 * Интерфейс для себестоимости товаров
 * PK: ni (Артикул WB)
 */
export interface IUnitCost {
  ni: number // Primary Key: Артикул WB (nmId)
  cost: number // Себестоимость товара (руб.)
  taxRate: number // Налоговая ставка (%)
}

/**
 * Интерфейс для товара в поставке
 */
export interface ISupplyItem {
  nmID: number // Артикул WB
  techSize: string // Размер товара
  quantity: number // Указано в поставке, шт
  acceptedQuantity: number | null // Принято, шт
  cost?: number // Себестоимость единицы товара (руб.)
}

/**
 * Интерфейс для поставок
 * PK: supplyID (ID поставки)
 */
export interface ISupply {
  supplyID: number // Primary Key: ID поставки
  factDate: string | null // Фактическая дата приемки (YYYY-MM-DD)
  createDate: string // Дата создания поставки (YYYY-MM-DD)
  supplyDate: string | null // Плановая дата отгрузки (YYYY-MM-DD)
  items: ISupplyItem[] // Массив товаров в поставке
}

/**
 * Интерфейс для товара в закупке из Китая
 */
export interface IPurchaseItem {
  nmID: number // Артикул WB
  vendorCode: string // Артикул продавца
  title?: string // Название товара (только для чтения)
  color?: string // Цвет товара (только для чтения)
  techSize: string // Размер товара
  weightPerUnit?: number // Вес единицы в кг
  priceCNY: number // Цена в CNY
  logisticsCNY: number // Логистика по Китаю в CNY
  fulfillmentRUB: number // Фулфилмент в RUB
  packagingRUB: number // Упаковка в RUB
  kizRUB: number // КИЗ в RUB
  quantity: number // Количество
}

/**
 * Интерфейс для закупки из Китая
 * PK: id (автоинкремент)
 */
export interface IPurchase {
  id?: number // Primary Key: автоинкремент
  date: string // Дата закупки (YYYY-MM-DD)
  orderNumber: string // Номер заказа
  status: string // Статус закупки
  exchangeRate: number // Курс CNY к RUB
  buyerCommissionPercent: number // Комиссия байера (%)
  logisticsToMoscow: number // Общая логистика до Москвы (RUB)
  items: IPurchaseItem[] // Массив товаров в закупке
}

/**
 * Интерфейс для загруженных периодов данных
 * PK: id (автоинкремент)
 * Используется для фиксации того, по какие даты уже загружены данные в базу
 */
export interface ILoadedPeriod {
  id?: number // Primary Key: автоинкремент
  ds: string // dataset - ключ датасета (sales, returns, logistics, etc.)
  pt: 'daily' | 'weekly' // periodType - тип периода
  fr: string // from - начало периода (ISO дата: YYYY-MM-DD)
  to: string // to - конец периода (ISO дата: YYYY-MM-DD)
  la: string // loadedAt - когда был загружен период (ISO дата+время)
  rc?: number // recordCount - количество загруженных записей (опционально)
}
