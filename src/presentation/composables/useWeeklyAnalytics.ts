import { ref } from 'vue'
import { useDI } from './useDependencyInjection'
import type { WeeklyAnalyticsResult } from '@application/use-cases/GetWeeklyAnalyticsUseCase'

export function useWeeklyAnalytics() {
  const di = useDI()
  const isLoading = ref(false)
  const data = ref<WeeklyAnalyticsResult | null>(null)
  const error = ref<Error | null>(null)

  const fetch = async () => {
    isLoading.value = true
    error.value = null

    try {
      const useCase = di.getGetWeeklyAnalyticsUseCase()
      data.value = await useCase.execute()
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
