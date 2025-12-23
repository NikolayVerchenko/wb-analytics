import { ref } from 'vue'
import { useDI } from './useDependencyInjection'
import type { SyncDataUseCaseOptions } from '@application/use-cases/SyncDataUseCase'

export function useSyncData() {
  const di = useDI()
  const isSyncing = ref(false)
  const progress = ref({ current: 0, total: 0 })
  const error = ref<Error | null>(null)

  const sync = async (options: SyncDataUseCaseOptions) => {
    isSyncing.value = true
    error.value = null
    progress.value = { current: 0, total: 0 }

    try {
      // Проверяем и обновляем API ключ из localStorage перед синхронизацией
      const apiKey = localStorage.getItem('wb_api_key')
      if (apiKey) {
        // Переинициализируем контейнер с актуальным ключом
        // Используем приведение типа, так как метод reinitialize существует, но не в типе
        const containerWithReinit = di as typeof di & { reinitialize: (key?: string) => void }
        if (typeof containerWithReinit.reinitialize === 'function') {
          containerWithReinit.reinitialize()
        }
      }

      const useCase = di.getSyncDataUseCase()
      await useCase.execute({
        ...options,
        onProgress: (current, total) => {
          progress.value = { current, total }
        },
      })
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  return {
    sync,
    isSyncing,
    progress,
    error,
  }
}
