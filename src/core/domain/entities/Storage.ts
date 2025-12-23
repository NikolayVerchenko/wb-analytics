export interface Storage {
  id?: number
  lastChangeDate: string
  supplierArticle: string
  techSize: string
  barcode: string
  quantity: number
  isSupply: boolean
  isRealization: boolean
  quantityFull: number
  quantityNotInOrders: number
  warehouse: number
  warehouseName: string
  inWayToClient: number
  inWayFromClient: number
  nmId: number
  subject: string
  category: string
  daysOnSite: number
  brand: string
  SCC: string
  Price: number
  Discount: number
}
