import type { ISale, IReturn, ILogistics, IPenalty, IAdvCost, IStorageCost, IAcceptanceCost, IProductOrder, IProductCard, IUnitCost, IWarehouseRemain, ISupply } from '../../../types/db'

export interface IDatabaseRepository {
  // Sales
  getSales(dateFrom: string, dateTo: string): Promise<ISale[]>
  getAllSales(): Promise<ISale[]>

  // Returns
  getReturns(dateFrom: string, dateTo: string): Promise<IReturn[]>

  // Logistics
  getLogistics(dateFrom: string, dateTo: string): Promise<ILogistics[]>

  // Penalties
  getPenalties(dateFrom: string, dateTo: string): Promise<IPenalty[]>

  // Costs
  getAdvCosts(dateFrom: string, dateTo: string): Promise<IAdvCost[]>
  getStorageCosts(dateFrom: string, dateTo: string): Promise<IStorageCost[]>
  getAcceptanceCosts(dateFrom: string, dateTo: string): Promise<IAcceptanceCost[]>

  // Orders
  getProductOrders(dateFrom: string, dateTo: string): Promise<IProductOrder[]>

  // Catalogs
  getProductCards(): Promise<IProductCard[]>
  getUnitCosts(): Promise<IUnitCost[]>
  getWarehouseRemains(): Promise<IWarehouseRemain[]>

  // Supplies
  getSupplies(): Promise<ISupply[]>
  getSupplyById(id: number): Promise<ISupply | undefined>
  saveSupply(supply: ISupply): Promise<void>
  updateSupplyItemCost(supplyID: number, nmID: number, techSize: string, cost: number | undefined): Promise<void>

  // Settings
  getSetting(key: string): Promise<{ key: string; value: string } | undefined>
  saveSetting(key: string, value: string): Promise<void>
}
