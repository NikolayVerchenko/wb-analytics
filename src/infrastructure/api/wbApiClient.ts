import type { IWBApiClient } from '../../core/domain/repositories/IWBApiClient'
import type { AxiosInstance } from 'axios'

export class WBApiClient implements IWBApiClient {
  constructor(
    private axiosInstance: AxiosInstance,
    private apiKey: string,
    private proxyUrl?: string
  ) {}

  async getSupplies(params: {
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
  }>> {
    const useProxy = this.proxyUrl !== undefined
    const baseURL = useProxy ? this.proxyUrl : 'https://supplies-api.wildberries.ru'
    const suppliesListUrl = useProxy
      ? `${baseURL}/supplies-api/api/v1/supplies`
      : `${baseURL}/api/v1/supplies`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (useProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    // POST запрос для получения списка поставок
    const suppliesResponse = await this.axiosInstance.post(
      suppliesListUrl,
      {
        dates: [
          {
            from: params.dateFrom,
            till: params.dateTo,
            type: 'factDate', // Тип даты: factDate для фактической даты приемки
          },
        ],
        statusIDs: params.statusIDs, // Статусы: 5 - Принято, 6 - Отгружено на воротах
      },
      {
        headers,
        params: {
          limit: 1000,
          offset: 0,
        },
      }
    )

    const suppliesList: Array<{
      supplyID: number | null
      preorderID?: number
      createDate: string
      supplyDate: string | null
      factDate: string | null
      updatedDate: string | null
      statusID: number
    }> = Array.isArray(suppliesResponse.data) ? suppliesResponse.data : []

    return suppliesList
  }

  async getSupplyGoods(supplyID: number): Promise<Array<{
    nmID: number
    techSize: string
    quantity: number
    acceptedQuantity: number | null
    readyForSaleQuantity?: number | null
  }>> {
    const useProxy = this.proxyUrl !== undefined
    const baseURL = useProxy ? this.proxyUrl : 'https://supplies-api.wildberries.ru'
    const goodsUrl = useProxy
      ? `${baseURL}/supplies-api/api/v1/supplies/${supplyID}/goods`
      : `${baseURL}/api/v1/supplies/${supplyID}/goods`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (useProxy) {
      headers['X-WB-API-Key'] = this.apiKey
    } else {
      headers['Authorization'] = this.apiKey
    }

    const goodsResponse = await this.axiosInstance.get(goodsUrl, {
      headers,
      params: {
        limit: 1000,
        offset: 0,
      },
    })

    const goods: Array<{
      nmID: number
      techSize: string
      quantity: number
      acceptedQuantity: number | null
      readyForSaleQuantity?: number | null
    }> = goodsResponse.data || []

    return goods
  }
}