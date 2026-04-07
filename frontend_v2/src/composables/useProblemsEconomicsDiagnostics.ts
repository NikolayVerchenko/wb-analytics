import { computed, ref, type Ref } from 'vue'
import type { EconomicsItem } from '../types/economics'

export type ProblemEconomicsStatus = 'profit' | 'risk' | 'loss'

export type ProblemEconomicsQuickFilter =
  | 'all'
  | 'loss'
  | 'risk'
  | 'top-advert'
  | 'top-returns'
  | 'top-profit'

export type ProblemEconomicsRow = EconomicsItem & {
  status: ProblemEconomicsStatus
  mainProblem: string
  advert_ratio: number | null
  logistics_ratio: number | null
  returns_ratio: number | null
  cogs_ratio: number | null
}

export type ProblemEconomicsSummaryCard = {
  key: string
  label: string
  value: string
  tone: ProblemEconomicsStatus | 'neutral'
}

export const problemQuickFilters: Array<{ value: ProblemEconomicsQuickFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'loss', label: 'Убыточные' },
  { value: 'risk', label: 'Риск' },
  { value: 'top-advert', label: 'Топ реклама' },
  { value: 'top-returns', label: 'Топ возвраты' },
  { value: 'top-profit', label: 'Топ прибыль' },
]

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function divideOrNull(numerator: number, denominator: number): number | null {
  if (!denominator) {
    return null
  }

  return numerator / denominator
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function detectStatus(item: EconomicsItem, advertRatio: number | null): ProblemEconomicsStatus {
  const profit = toNumber(item.profit_amount)
  const margin = toNumber(item.margin_percent)
  const roi = toNumber(item.roi_percent)
  const buyout = toNumber(item.buyout_percent)

  if (profit <= 0) {
    return 'loss'
  }

  if (
    margin < 15 ||
    roi < 40 ||
    buyout < 45 ||
    (advertRatio !== null && advertRatio > 0.15)
  ) {
    return 'risk'
  }

  return 'profit'
}

function detectMainProblem(
  item: EconomicsItem,
  metrics: {
    advertRatio: number | null
    logisticsRatio: number | null
    returnsRatio: number | null
    cogsRatio: number | null
  },
) {
  const profit = toNumber(item.profit_amount)
  const buyout = toNumber(item.buyout_percent)

  if (profit <= 0 && metrics.advertRatio !== null && metrics.advertRatio > 0.15) {
    return 'Высокая реклама'
  }

  if (buyout < 45) {
    return 'Низкий выкуп'
  }

  if (metrics.logisticsRatio !== null && metrics.logisticsRatio > 0.18) {
    return 'Высокая логистика'
  }

  if (metrics.returnsRatio !== null && metrics.returnsRatio > 0.15) {
    return 'Возвраты'
  }

  if (metrics.cogsRatio !== null && metrics.cogsRatio > 0.55) {
    return 'Высокая себестоимость'
  }

  return 'Низкая маржа'
}

export function useProblemsEconomicsDiagnostics(items: Ref<EconomicsItem[]>) {
  const quickFilter = ref<ProblemEconomicsQuickFilter>('all')

  const diagnosticRows = computed<ProblemEconomicsRow[]>(() =>
    items.value.map((item) => {
      const sellerTransfer = toNumber(item.seller_transfer)
      const salesQuantity = toNumber(item.sales_quantity)
      const advertCost = toNumber(item.advert_cost)
      const deliveryCost = toNumber(item.delivery_cost)
      const returnQuantity = toNumber(item.return_quantity)
      const cogsAmount = toNumber(item.cogs_amount)

      const advertRatio = divideOrNull(advertCost, sellerTransfer)
      const logisticsRatio = divideOrNull(deliveryCost, sellerTransfer)
      const returnsRatio = divideOrNull(returnQuantity, salesQuantity)
      const cogsRatio = divideOrNull(cogsAmount, toNumber(item.realization_after_spp))
      const status = detectStatus(item, advertRatio)
      const mainProblem = detectMainProblem(item, {
        advertRatio,
        logisticsRatio,
        returnsRatio,
        cogsRatio,
      })

      return {
        ...item,
        status,
        mainProblem,
        advert_ratio: advertRatio,
        logistics_ratio: logisticsRatio,
        returns_ratio: returnsRatio,
        cogs_ratio: cogsRatio,
      }
    }),
  )

  const summaryCards = computed<ProblemEconomicsSummaryCard[]>(() => {
    const rows = diagnosticRows.value
    const lossCount = rows.filter((row) => row.status === 'loss').length
    const riskCount = rows.filter((row) => row.status === 'risk').length
    const profitCount = rows.filter((row) => row.status === 'profit').length
    const lossProfit = rows
      .filter((row) => row.status === 'loss')
      .reduce((sum, row) => sum + toNumber(row.profit_amount), 0)

    return [
      { key: 'profit', label: 'Прибыльные SKU', value: formatInteger(profitCount), tone: 'profit' },
      { key: 'risk', label: 'SKU в риске', value: formatInteger(riskCount), tone: 'risk' },
      { key: 'loss', label: 'Убыточные SKU', value: formatInteger(lossCount), tone: 'loss' },
      { key: 'loss-profit', label: 'Потери по убыточным', value: formatInteger(lossProfit), tone: 'neutral' },
    ]
  })

  const filteredRows = computed<ProblemEconomicsRow[]>(() => {
    const rows = [...diagnosticRows.value]

    switch (quickFilter.value) {
      case 'loss':
        return rows
          .filter((row) => row.status === 'loss')
          .sort((left, right) => toNumber(left.profit_amount) - toNumber(right.profit_amount))
      case 'risk':
        return rows
          .filter((row) => row.status === 'risk')
          .sort((left, right) => toNumber(left.margin_percent) - toNumber(right.margin_percent))
      case 'top-advert':
        return rows.sort((left, right) => toNumber(right.advert_cost) - toNumber(left.advert_cost))
      case 'top-returns':
        return rows.sort((left, right) => toNumber(right.return_quantity) - toNumber(left.return_quantity))
      case 'top-profit':
        return rows.sort((left, right) => toNumber(right.profit_amount) - toNumber(left.profit_amount))
      case 'all':
      default:
        return rows.sort((left, right) => {
          const statusWeight = { loss: 0, risk: 1, profit: 2 }
          const leftWeight = statusWeight[left.status]
          const rightWeight = statusWeight[right.status]
          if (leftWeight !== rightWeight) {
            return leftWeight - rightWeight
          }
          return toNumber(left.profit_amount) - toNumber(right.profit_amount)
        })
    }
  })

  return {
    quickFilter,
    summaryCards,
    diagnosticRows,
    filteredRows,
  }
}
