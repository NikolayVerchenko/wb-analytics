import type { DatasetKey } from './types'
import type { LoadedPeriodRepository } from './LoadedPeriodRepository'
import type { SyncRunner } from './SyncRunner'
import type { SyncPlan } from './SyncJob'
import type { ILoadedPeriod } from '../../types/db'
import { buildWeeksArray, type WeeksArray } from './calendar'
import type { ISODate } from './calendar'

export type BackfillResult = {
  loaded: number
  skipped: number
  errors: Array<{ week: { from: string; to: string }; error: string }>
}

export type BackfillProgress = {
  current: number
  total: number
  currentWeek: { from: string; to: string }
  status: string
}

/**
 * Сервис для управления загрузкой данных по массиву недель
 * 
 * Следует принципам SOLID:
 * - SRP: Отвечает только за координацию загрузки по массиву недель
 * - DIP: Зависит от абстракций (LoadedPeriodRepository, SyncRunner)
 * - OCP: Расширяем через параметры
 */
export class WeeksBackfillService {
  constructor(
    private readonly periodRepo: LoadedPeriodRepository,
    private readonly runner: SyncRunner,
    private readonly dataset: DatasetKey = 'sales'
  ) {}

  /**
   * Запускает загрузку данных по массиву недель
   * 
   * Логика:
   * 1. Строит массив недель от today до lowerBound
   * 2. Проверяет, какие периоды уже загружены
   * 3. Фильтрует незагруженные периоды
   * 4. Загружает каждый незагруженный период:
   *    - Неполная неделя → daily режим
   *    - Полная неделя → weekly режим
   * 
   * @param today - Текущая дата
   * @param lowerBound - Нижняя граница (по умолчанию '2024-01-29')
   * @param onProgress - Callback для отслеживания прогресса (опционально)
   * @returns Результат загрузки
   */
  async startBackfill(
    today: Date,
    lowerBound: ISODate = '2024-01-29',
    onProgress?: (progress: BackfillProgress) => void
  ): Promise<BackfillResult> {
    console.log(`[WeeksBackfillService][${this.dataset}] 🚀 Начало загрузки для dataset=${this.dataset}, lowerBound=${lowerBound}`)

    // 1. Строим массив недель
    const weeksArray = buildWeeksArray(today, lowerBound)
    console.log(`[WeeksBackfillService][${this.dataset}] 📅 Построено ${weeksArray.fullWeeks.length} полных недель${weeksArray.incompleteWeek ? ' + 1 неполная' : ''}`)

    // 2. Получаем загруженные периоды
    const loadedPeriods = await this.periodRepo.getByDataset(this.dataset)
    console.log(`[WeeksBackfillService][${this.dataset}] 📊 Найдено ${loadedPeriods.length} загруженных периодов`)

    // 3. Фильтруем незагруженные периоды
    const unloadedWeeks = this.filterUnloadedWeeks(weeksArray, loadedPeriods)
    console.log(`[WeeksBackfillService][${this.dataset}] ⏳ Незагруженных недель: ${unloadedWeeks.length}`)

    if (unloadedWeeks.length === 0) {
      console.log(`[WeeksBackfillService][${this.dataset}] ✅ Все периоды уже загружены`)
      return { loaded: 0, skipped: weeksArray.fullWeeks.length + (weeksArray.incompleteWeek ? 1 : 0), errors: [] }
    }

    // 4. Загружаем каждый незагруженный период
    const result: BackfillResult = {
      loaded: 0,
      skipped: 0,
      errors: [],
    }

    const totalWeeks = unloadedWeeks.length
    for (let i = 0; i < unloadedWeeks.length; i++) {
      const week = unloadedWeeks[i]
      
      // Уведомляем о прогрессе
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: totalWeeks,
          currentWeek: week.range,
          status: `Загрузка недели ${week.range.from} - ${week.range.to}`,
        })
      }
      try {
        const syncMode = week.isIncomplete ? 'daily' : 'weekly'
        console.log(`[WeeksBackfillService][${this.dataset}] Загрузка недели ${week.range.from} - ${week.range.to} (${syncMode})`)

        // Создаем план для конкретного периода
        const plan: SyncPlan = {
          dataset: this.dataset,
          range: week.range,
          mode: 'backfill',
          syncMode,
        }

        // Задержка между запросами для избежания 429 ошибок (2 секунды между неделями)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Выполняем загрузку через SyncRunner
        const runResult = await this.runner.runWithPlan(plan)

        if (runResult && runResult.applied > 0) {
          result.loaded++
          console.log(`[WeeksBackfillService][${this.dataset}] ✅ Загружена неделя ${week.range.from} - ${week.range.to}: ${runResult.applied} записей`)
        } else {
          result.skipped++
          console.log(`[WeeksBackfillService][${this.dataset}] ⏭️ Пропущена неделя ${week.range.from} - ${week.range.to} (нет данных)`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push({
          week: week.range,
          error: errorMessage,
        })
        console.error(`[WeeksBackfillService][${this.dataset}] ❌ Ошибка при загрузке недели ${week.range.from} - ${week.range.to}:`, error)
        // Продолжаем загрузку других недель
      }
    }

    console.log(`[WeeksBackfillService][${this.dataset}] ✅ Загрузка завершена: загружено=${result.loaded}, пропущено=${result.skipped}, ошибок=${result.errors.length}`)
    return result
  }

  /**
   * Фильтрует незагруженные недели
   * 
   * @param weeksArray - Массив недель
   * @param loadedPeriods - Загруженные периоды
   * @returns Массив незагруженных недель с флагом isIncomplete
   */
  private filterUnloadedWeeks(
    weeksArray: WeeksArray,
    loadedPeriods: ILoadedPeriod[]
  ): Array<{ range: { from: string; to: string }; isIncomplete: boolean }> {
    const unloaded: Array<{ range: { from: string; to: string }; isIncomplete: boolean }> = []

    // Проверяем неполную неделю
    if (weeksArray.incompleteWeek) {
      const isLoaded = loadedPeriods.some(
        p => p.fr === weeksArray.incompleteWeek!.from && 
             p.to === weeksArray.incompleteWeek!.to &&
             p.pt === 'daily'
      )
      if (!isLoaded) {
        unloaded.push({
          range: weeksArray.incompleteWeek,
          isIncomplete: true,
        })
      }
    }

    // Проверяем полные недели
    for (const week of weeksArray.fullWeeks) {
      const isLoaded = loadedPeriods.some(
        p => p.fr === week.from && 
             p.to === week.to &&
             p.pt === 'weekly'
      )
      if (!isLoaded) {
        unloaded.push({
          range: week,
          isIncomplete: false,
        })
      }
    }

    return unloaded
  }
}
