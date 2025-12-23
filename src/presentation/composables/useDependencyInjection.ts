import { inject, provide, type InjectionKey } from 'vue'
import { container, type DIContainer } from '@core/di/container'

export const DI_KEY: InjectionKey<DIContainer> = Symbol('DI')

export function provideDI(): void {
  provide(DI_KEY, container)
}

export function useDI(): DIContainer {
  const di = inject(DI_KEY)
  if (!di) {
    throw new Error('DI not provided. Make sure to call provideDI() in the root component.')
  }
  return di
}
