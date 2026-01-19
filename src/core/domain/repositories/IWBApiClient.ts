export interface IWBApiClient {
  getSupplies(params: {
    dateFrom: string
    dateTo: string
    statusIDs: number[]
  }): Promise<Array<{
    supplyID: number | null
    preorderID?: number
    createDate: string
    supplyDate: string | null
    factDate: string | null
    updatedDate: string | null
    statusID: number
  }>>

  getSupplyGoods(supplyID: number): Promise<Array<{
    nmID: number
    techSize: string
    quantity: number
    acceptedQuantity: number | null
    readyForSaleQuantity?: number | null
  }>>
}
