import { ref } from 'vue'
import { useDI } from './useDependencyInjection'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import { ReportTotalsCalculator } from '../../application/services/ReportTotalsCalculator'
import type { ProductAggregate } from '../../types/analytics'

type WeeklyAnalyticsWeek = {
  weekId: string
  period: string
  totalSales: number
  salesBeforeSpp: number
  totalReturns: number
  logistics: number
  netPay: number
}

type WeeklyAnalyticsResult = {
  totals: {
    totalSales: number
    salesBeforeSpp: number
    totalReturns: number
    logistics: number
    netPay: number
  }
  weeks: WeeklyAnalyticsWeek[]
}

export function useWeeklyAnalytics() {
  const di = useDI()
  const analyticsStore = useAnalyticsStore()
  const isLoading = ref(false)
  const data = ref<WeeklyAnalyticsResult | null>(null)
  const error = ref<Error | null>(null)

  const fetch = async () => {
    isLoading.value = true
    error.value = null

    try {
      // TODO: Восстановить после реализации GetWeeklyAnalyticsUseCase в DI контейнере
      // const useCase = di.getGetWeeklyAnalyticsUseCase()
      // data.value = await useCase.execute()

      // Временное решение: строим агрегат из данных сводки
      console.warn('[useWeeklyAnalytics] GetWeeklyAnalyticsUseCase не реализован в DI контейнере')
      const rows = analyticsStore.aggregatedReport as ProductAggregate[]
      const dateFrom = analyticsStore.filters.dateFrom || ''
      const dateTo = analyticsStore.filters.dateTo || ''
      const periodLabel = dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : 'Текущий период'

      const totals = ReportTotalsCalculator.calculateTotals(
        rows,
        analyticsStore.storageCosts,
        analyticsStore.acceptanceCosts,
        dateFrom || undefined,
        dateTo || undefined
      )

      const returnsSum = rows.reduce((sum, product) => sum + (product.returnsRevenue || 0), 0)

      const result: WeeklyAnalyticsResult = {
        totals: {
          totalSales: totals.totalNetRevenue,
          salesBeforeSpp: totals.totalRevenue,
          totalReturns: returnsSum,
          logistics: totals.totalLogistics,
          netPay: totals.totalTransferAmount,
        },
        weeks: [
          {
            weekId: periodLabel,
            period: periodLabel,
            totalSales: totals.totalNetRevenue,
            salesBeforeSpp: totals.totalRevenue,
            totalReturns: returnsSum,
            logistics: totals.totalLogistics,
            netPay: totals.totalTransferAmount,
          },
        ],
      }

      data.value = result
      return data.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    fetch,
    data,
    isLoading,
    error,
  }
}
