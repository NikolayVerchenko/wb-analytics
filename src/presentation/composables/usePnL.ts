import { ref } from 'vue'
import { useDI } from './useDependencyInjection'
import type { CalculatePnLOptions, PnLResult } from '@application/use-cases/CalculatePnLUseCase'

export function usePnL() {
  const di = useDI()
  const isLoading = ref(false)
  const result = ref<PnLResult | null>(null)
  const error = ref<Error | null>(null)

  const calculate = async (options: CalculatePnLOptions) => {
    isLoading.value = true
    error.value = null

    try {
      const useCase = di.getCalculatePnLUseCase()
      result.value = await useCase.execute(options)
      return result.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    calculate,
    result,
    isLoading,
    error,
  }
}
