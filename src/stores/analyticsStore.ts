import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ISale, IReturn, ILogistics, IPenalty, IAdvCost, IAcceptanceCost, IStorageCost, IProductOrder, IProductCard, IUnitCost, IWarehouseRemain, ISupply, ISupplyItem } from '../types/db'
import type { DataLoadingService } from '../application/services/DataLoadingService'
import type { ReportAggregationService } from '../application/services/ReportAggregationService'
import type { SupplyService } from '../application/services/SupplyService'
import type { ProductAggregate } from '../types/analytics'
import { AggregationController } from '../application/controllers/AggregationController'

/**
 * Store для аналитических данных
 * Обеспечивает ступенчатую загрузку данных из БД:
 * 1. Приоритетная загрузка последнего месяца
 * 2. Фоновая загрузка данных за год
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  // State: Данные из финансовых таблиц
  const sales = ref<ISale[]>([])
  const returns = ref<IReturn[]>([])
  const logistics = ref<ILogistics[]>([])
  const penalties = ref<IPenalty[]>([])
  const advCosts = ref<IAdvCost[]>([])
  const storageCosts = ref<IStorageCost[]>([])
  const acceptanceCosts = ref<IAcceptanceCost[]>([])
  const productOrders = ref<IProductOrder[]>([])

  // State: Справочники (загружаются полностью)
  const productCards = ref<IProductCard[]>([])
  const unitCosts = ref<IUnitCost[]>([])
  const warehouseRemains = ref<IWarehouseRemain[]>([])
  const supplies = ref<ISupply[]>([])

  // State: Флаги загрузки
  const isInitialLoading = ref<boolean>(false)
  const isHistoryLoading = ref<boolean>(false)
  const isReady = ref<boolean>(false)

  // State: Прогресс загрузки истории (для синхронизации)
  const backfillProgress = ref<{
    isLoading: boolean
    status: string
    progressInfo: {
      current: number
      total: number
      currentWeek: string
      percentage: number
      currentDataset?: string
    } | null
    result: {
      totalWeeks: number
      loadedWeeks: number
      skippedWeeks: number
      errors: Array<{ week: { from: string; to: string }; dataset: string; error: string }>
      details: Array<{
        week: { from: string; to: string }
        datasets: Array<{ dataset: string; loaded: boolean; records?: number }>
      }>
    } | null
    error: string | null
  }>({
    isLoading: false,
    status: '',
    progressInfo: null,
    result: null,
    error: null,
  })

  const dataFreshness = ref<{
    updatedAt: string | null
    items: Array<{
      dataset: string
      latestDate: string | null
      missingFrom: string | null
      missingTo: string | null
    }>
  }>({
    updatedAt: null,
    items: [],
  })

  const weeklyReportReadiness = ref<{
    ready: boolean
    checkedAt: string | null
    range: { from: string; to: string } | null
    reason: string | null
  }>({
    ready: false,
    checkedAt: null,
    range: null,
    reason: null,
  })

  const weeklyReportAutoSync = ref<{
    running: boolean
    lastRunAt: string | null
    lastSyncAt: string | null
    status: string | null
  }>({
    running: false,
    lastRunAt: null,
    lastSyncAt: null,
    status: null,
  })

  const startupLogs = ref<Array<{
    at: string
    level: 'info' | 'warn' | 'error'
    message: string
  }>>([])
  // State: Фильтры для агрегации
  const filters = ref<{
    dateFrom: string | null
    dateTo: string | null
  }>({
    dateFrom: null,
    dateTo: null,
  })

  // State: Глобальная налоговая ставка
  const globalTaxRate = ref<number>(6)

  // Тип для причин пересчёта агрегированного отчёта
  type RecomputeReason =
    | 'initial-ready'
    | 'filters-changed'
    | 'history-loaded'
    | 'supplies-loaded'
    | 'supply-cost-updated'
    | 'thaw'
    | 'manual'

  // Сервисы (инициализируются через фабрику или provide/inject)
  let dataLoadingService: DataLoadingService | null = null
  let reportAggregationService: ReportAggregationService | null = null
  let supplyService: SupplyService | null = null

  // Инициализация сервисов (вызывается из App.vue или composable)
  const initializeServices = (
    dataLoader: DataLoadingService,
    reportAggregator: ReportAggregationService,
    supply: SupplyService
  ) => {
    dataLoadingService = dataLoader
    reportAggregationService = reportAggregator
    supplyService = supply
  }

  const aggregateReportForPeriod = async (dateFrom: string, dateTo: string) => {
    if (!reportAggregationService) {
      throw new Error('reportAggregationService is not initialized. Call initializeServices() first.')
    }
    return reportAggregationService.aggregateReport({
      dateFrom,
      dateTo,
      globalTaxRate: globalTaxRate.value,
    })
  }

  const addStartupLog = (entry: { level: 'info' | 'warn' | 'error'; message: string; at?: string }) => {
    startupLogs.value.unshift({
      at: entry.at ?? new Date().toISOString(),
      level: entry.level,
      message: entry.message,
    })
  }

  /**
   * Форматирует дату в формат YYYY-MM-DD
   */
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  /**
   * Helper: проверяет, установлены ли фильтры дат
   */
  const hasFilters = (): boolean => {
    return !!(filters.value.dateFrom && filters.value.dateTo)
  }

  /**
   * Helper: фильтрует поставки с себестоимостью для логирования
   */
  const getSuppliesWithCosts = (suppliesList: ISupply[]) => {
    return suppliesList
      .map(supply => ({
        supplyID: supply.supplyID,
        itemsCount: supply.items.length,
        itemsWithCost: supply.items.filter((item: ISupplyItem) => item.cost !== undefined && item.cost !== null).length,
        items: supply.items
          .filter((item: ISupplyItem) => item.cost !== undefined && item.cost !== null)
          .map((item: ISupplyItem) => ({ nmID: item.nmID, techSize: item.techSize, cost: item.cost }))
      }))
      .filter(s => s.itemsWithCost > 0)
  }

  /**
   * Загружает все данные из БД с ступенчатой загрузкой:
   * 1. Приоритетная загрузка последнего месяца
   * 2. Фоновая загрузка данных за год (от года назад до месяца назад)
   */
  const loadAllDataFromDb = async () => {
    if (!dataLoadingService) {
      throw new Error('DataLoadingService not initialized')
    }

    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
    const oneYearAgo = new Date(now)
    oneYearAgo.setDate(oneYearAgo.getDate() - 365)

    const dateNow = formatDate(now)
    const dateOneMonthAgo = formatDate(oneMonthAgo)
    const dateOneYearAgo = formatDate(oneYearAgo)

    console.log(`[AnalyticsStore] Начало загрузки данных`)
    console.log(`[AnalyticsStore] Период приоритетной загрузки: ${dateOneMonthAgo} - ${dateNow}`)
    console.log(`[AnalyticsStore] Период фоновой загрузки: ${dateOneYearAgo} - ${dateOneMonthAgo}`)
    addStartupLog({
      level: 'info',
      message: `БД: приоритетная загрузка ${dateOneMonthAgo} - ${dateNow}`,
    })
    addStartupLog({
      level: 'info',
      message: `БД: фоновая загрузка ${dateOneYearAgo} - ${dateOneMonthAgo}`,
    })

    // Этап 1: Приоритетная загрузка последнего месяца
    console.log('⏳ Начинаю загрузку первого месяца данных...')
    const startTimeInitial = Date.now()
    isInitialLoading.value = true

    try {
      // Загружаем данные за последний месяц через сервис
      const priorityData = await dataLoadingService.loadPriorityData(dateOneMonthAgo, dateNow)
      const catalogData = await dataLoadingService.loadCatalogData()

      // Сохраняем данные в state
      sales.value = priorityData.sales
      returns.value = priorityData.returns
      logistics.value = priorityData.logistics
      penalties.value = priorityData.penalties
      advCosts.value = priorityData.advCosts
      storageCosts.value = priorityData.storageCosts
      acceptanceCosts.value = priorityData.acceptanceCosts
      productOrders.value = priorityData.productOrders
      productCards.value = catalogData.productCards
      unitCosts.value = catalogData.unitCosts
      warehouseRemains.value = catalogData.warehouseRemains
      supplies.value = catalogData.supplies
      
      // Логируем поставки с себестоимостью при загрузке
      const loadedSuppliesWithCosts = getSuppliesWithCosts(catalogData.supplies)
      
      console.log(`[AnalyticsStore] loadAllDataFromDb: загружено поставок=${catalogData.supplies.length}, с себестоимостью=${loadedSuppliesWithCosts.length}`)
      if (loadedSuppliesWithCosts.length > 0) {
        console.log(`[AnalyticsStore] loadAllDataFromDb: поставки с себестоимостью:`, loadedSuppliesWithCosts)
      }

      // Загружаем глобальную налоговую ставку через сервис
      globalTaxRate.value = await dataLoadingService.getGlobalTaxRate()

      isReady.value = true
      isInitialLoading.value = false

      const initialLoadTime = Date.now() - startTimeInitial
      addStartupLog({
        level: 'info',
        message: `БД: приоритетная загрузка завершена (${initialLoadTime} мс)`,
      })
      console.log(`[AnalyticsStore] ✅ Приоритетная загрузка завершена за ${initialLoadTime} мс`)
      console.log(`✅ Первый месяц загружен: ${sales.value.length} записей продаж в памяти.`)
      console.log(`[AnalyticsStore]   - Продажи: ${priorityData.sales.length}`)
      console.log(`[AnalyticsStore]   - Возвраты: ${priorityData.returns.length}`)
      console.log(`[AnalyticsStore]   - Логистика: ${priorityData.logistics.length}`)
      console.log(`[AnalyticsStore]   - Реклама: ${priorityData.advCosts.length}`)
      console.log(`[AnalyticsStore]   - Хранение: ${priorityData.storageCosts.length}`)
      console.log(`[AnalyticsStore]   - Приемка: ${priorityData.acceptanceCosts.length}`)
      console.log(`[AnalyticsStore]   - Заказы: ${priorityData.productOrders.length}`)
      console.log(`[AnalyticsStore]   - Карточки товаров: ${catalogData.productCards.length}`)
      console.log(`[AnalyticsStore]   - Себестоимость: ${catalogData.unitCosts.length}`)

      // Этап 2: Фоновая загрузка данных за год (от года назад до месяца назад)
      isHistoryLoading.value = true

      // Запускаем фоновую загрузку асинхронно (не блокируем UI)
      loadHistoryData(dateOneYearAgo, dateOneMonthAgo).catch(error => {
        console.error('[AnalyticsStore] Ошибка при фоновой загрузке истории:', error)
        isHistoryLoading.value = false
      })
    } catch (error) {
      console.error('[AnalyticsStore] Ошибка при приоритетной загрузке:', error)
      isInitialLoading.value = false
      throw error
    }
  }

  /**
   * Фоновая загрузка исторических данных
   */
  const loadHistoryData = async (dateFrom: string, dateTo: string) => {
    if (!dataLoadingService) {
      throw new Error('DataLoadingService not initialized')
    }

    console.log(`[AnalyticsStore] Начало фоновой загрузки истории: ${dateFrom} - ${dateTo}`)
    const startTimeHistory = Date.now()
    addStartupLog({
      level: 'info',
      message: `БД: фоновая загрузка начата ${dateFrom} - ${dateTo}`,
    })

    try {
      // Загружаем исторические данные через сервис
      const historyData = await dataLoadingService.loadHistoryData(dateFrom, dateTo)

      // Добавляем исторические данные в существующие массивы
      sales.value.push(...historyData.sales)
      returns.value.push(...historyData.returns)
      logistics.value.push(...historyData.logistics)
      penalties.value.push(...historyData.penalties)
      advCosts.value.push(...historyData.advCosts)
      storageCosts.value.push(...historyData.storageCosts)
      acceptanceCosts.value.push(...historyData.acceptanceCosts)
      productOrders.value.push(...historyData.productOrders)

      isHistoryLoading.value = false

      // Автоматически обновляем агрегированный отчёт после загрузки истории
      void requestAggregatedRecompute('history-loaded', { debounceMs: 300 })

      const historyLoadTime = Date.now() - startTimeHistory
      console.log(`[AnalyticsStore] ✅ Фоновая загрузка истории завершена за ${historyLoadTime} мс`)
      console.log(`🚀 История за год подгружена! Всего в памяти: ${sales.value.length} записей продаж.`)
      console.log(`[AnalyticsStore]   - Продажи (добавлено): ${historyData.sales.length}`)
      console.log(`[AnalyticsStore]   - Возвраты (добавлено): ${historyData.returns.length}`)
      console.log(`[AnalyticsStore]   - Логистика (добавлено): ${historyData.logistics.length}`)
      console.log(`[AnalyticsStore]   - Реклама (добавлено): ${historyData.advCosts.length}`)
      console.log(`[AnalyticsStore]   - Хранение (добавлено): ${historyData.storageCosts.length}`)
      console.log(`[AnalyticsStore]   - Приемка (добавлено): ${historyData.acceptanceCosts.length}`)
      console.log(`[AnalyticsStore]   - Заказы (добавлено): ${historyData.productOrders.length}`)
      console.log(`[AnalyticsStore] Всего записей после загрузки истории: ${totalRecordsCount.value}`)
      addStartupLog({
        level: 'info',
        message: `БД: фоновая загрузка завершена (${historyLoadTime} мс)`,
      })
    } catch (error) {
      console.error('[AnalyticsStore] Ошибка при фоновой загрузке истории:', error)
      isHistoryLoading.value = false
      throw error
    }
  }

  /**
   * Геттер: суммарное количество записей во всех массивах
   */
  const totalRecordsCount = computed(() => {
    return (
      sales.value.length +
      returns.value.length +
      logistics.value.length +
      penalties.value.length +
      advCosts.value.length +
      storageCosts.value.length +
      acceptanceCosts.value.length +
      productOrders.value.length +
      productCards.value.length +
      unitCosts.value.length +
      warehouseRemains.value.length
    )
  })

  // Кеш для агрегированного отчета
  const aggregatedReportData = ref<ProductAggregate[]>([])

  // Флаг успешного расчёта агрегированного отчёта
  const hasAggregatedReportEverComputed = ref(false)

  // Флаг реального выполнения пересчёта (не debounce/pending, а именно расчёт)
  const isAggregating = ref(false)

  // Токен для race-safety коммита результата
  let latestRunId = 0

  // Флаг для invalidateOnRequest (сохраняем для проверки в run)
  let invalidateOnRequestEnabled = false

  // Контроллер пересчёта агрегированного отчёта
  const aggregationController = new AggregationController<RecomputeReason>(
    // hasPrerequisites
    () => {
      return hasFilters() && reportAggregationService !== null
    },
    // onInvalidate
    () => {
      aggregatedReportData.value = []
      hasAggregatedReportEverComputed.value = false
    },
    // run
    async (reason: RecomputeReason, runId: number, canCommit: () => boolean) => {
      if (!reportAggregationService) {
        throw new Error('reportAggregationService is not initialized. Call initializeServices() first.')
      }

      // Используем runId из контроллера для race-safety
      const myRunId = runId
      // Запоминаем актуальный runId (старые runs не смогут коммитить)
      // Если invalidateOnRequest=false, обновляем здесь (в начале run)
      // Если invalidateOnRequest=true, latestRunId уже обновлён в onRunScheduled
      if (!invalidateOnRequestEnabled) {
        latestRunId = runId
      }

      console.log(`[AnalyticsStore] refreshAggregatedReport triggered`, reason)
      console.log(`[AnalyticsStore] aggregatedReport: начало расчета, supplies.value.length=${supplies.value.length}`)

      // Устанавливаем флаг реального пересчёта непосредственно перед вызовом aggregateReport
      isAggregating.value = true

      try {
        const report = await reportAggregationService.aggregateReport({
          dateFrom: filters.value.dateFrom!,
          dateTo: filters.value.dateTo!,
          globalTaxRate: globalTaxRate.value,
        })

        // КОММИТ ТОЛЬКО ЕСЛИ АКТУАЛЬНО (race-safety: проверка runId перед коммитом)
        if (myRunId !== latestRunId) {
          console.log(`[AnalyticsStore] aggregatedReport: пропущен коммит (runId ${myRunId} устарел, текущий ${latestRunId})`)
          return
        }

        // Проверка canCommit (учитывает freezeBehavior="block-commit")
        if (!canCommit()) {
          console.log(`[AnalyticsStore] aggregatedReport: пропущен коммит (freezeBehavior="block-commit" и контроллер заморожен)`)
          return
        }

        console.log(`[AnalyticsStore] aggregatedReport: расчет завершен, результат содержит ${report.length} товаров`)
        aggregatedReportData.value = report
        hasAggregatedReportEverComputed.value = true
      } catch (error) {
        console.error('[AnalyticsStore] Ошибка при агрегации отчета:', error)

        // если уже устарел — не трогаем стор и НЕ бросаем ошибку дальше
        if (myRunId !== latestRunId) {
          return
        }

        aggregatedReportData.value = []
        hasAggregatedReportEverComputed.value = false
        throw error
      } finally {
        // Сбрасываем флаг реального пересчёта только для актуального run
        if (myRunId === latestRunId) {
          isAggregating.value = false
        }
      }
    },
    // onRunScheduled (для invalidateOnRequest=true)
    (runId: number) => {
      // Немедленно обновляем latestRunId при новом request (до debounce)
      latestRunId = runId
    },
    // onBatchCompleted
    (reasons: RecomputeReason[]) => {
      console.log('[AnalyticsStore] recompute batch completed', reasons)
    },
    // options
    {
      freezeBehavior: 'block-new-only', // Можно изменить на 'block-commit' при необходимости
      invalidateOnRequest: false, // Можно включить для мгновенной инвалидации
    }
  )

  // Сохраняем флаг invalidateOnRequest для проверки в run
  invalidateOnRequestEnabled = aggregationController.invalidateOnRequest

  /**
   * Геттер: агрегированный отчет по товарам за выбранный период (иерархия: Артикул -> Размеры)
   */
  const aggregatedReport = computed(() => {
    if (!hasFilters()) {
      return []
    }

    return aggregatedReportData.value
  })

  /**
   * Computed: сумма расходов на хранение за период
   */
  const storageCostsSumByRange = computed(() => {
    if (!hasFilters()) {
      return 0
    }

    const dateFrom = filters.value.dateFrom!
    const dateTo = filters.value.dateTo!
    return storageCosts.value.reduce((sum, storage) => {
      if (storage.dt >= dateFrom && storage.dt <= dateTo) {
        return sum + (storage.sc || 0)
      }
      return sum
    }, 0)
  })

  /**
   * Computed: сумма расходов на приемку за период
   */
  const acceptanceCostsSumByRange = computed(() => {
    if (!hasFilters()) {
      return 0
    }

    const dateFrom = filters.value.dateFrom!
    const dateTo = filters.value.dateTo!
    return acceptanceCosts.value.reduce((sum, acceptance) => {
      if (acceptance.dt >= dateFrom && acceptance.dt <= dateTo) {
        return sum + (acceptance.costs || 0)
      }
      return sum
    }, 0)
  })

  /**
   * Computed: флаг "грязности" агрегированного отчёта
   * Возвращает true, если есть ожидающие причины пересчёта или отчёт ещё не был рассчитан
   */
  const isAggregatedReportDirty = computed(() => {
    if (!hasFilters()) {
      return false
    }
    return aggregationController.getPending().length > 0 || !hasAggregatedReportEverComputed.value
  })

  /**
   * Computed: флаг обновления агрегированного отчёта
   * Возвращает true, если есть ожидающие причины пересчёта и отчёт не заморожен
   */
  const isAggregatedReportUpdating = computed(() => {
    if (!hasFilters()) {
      return false
    }
    return aggregationController.getPending().length > 0 && !aggregationController.getFrozen()
  })

  /**
   * Замораживает пересчёт агрегированного отчёта
   * В замороженном состоянии причины накапливаются, но пересчёт не выполняется
   */
  const freezeAggregatedRecompute = () => {
    aggregationController.freeze()
  }

  /**
   * Размораживает пересчёт агрегированного отчёта
   * Если есть накопленные причины, выполняет пересчёт
   */
  const thawAggregatedRecompute = () => {
    aggregationController.thaw()
  }

  /**
   * Принудительно запускает пересчёт агрегированного отчёта
   * Используется для ручного обновления из UI
   */
  const forceRecomputeAggregatedReport = () => {
    void aggregationController.request('manual', { debounceMs: 0 })
  }

  /**
   * Запрашивает пересчёт агрегированного отчёта
   * @param reason Причина пересчёта
   * @param opts Опции для обновления (debounce в миллисекундах)
   */
  const requestAggregatedRecompute = async (reason: RecomputeReason, opts?: { debounceMs?: number }) => {
    await aggregationController.request(reason, opts)
  }

  // Watcher для обновления агрегированного отчета при изменении фильтров
  watch(
    () => [isReady.value, filters.value.dateFrom, filters.value.dateTo, globalTaxRate.value] as const,
    ([isReady], prevVal) => {
      if (!isReady) {
        return
      }
      const prevIsReady = prevVal?.[0]
      // Если isReady стал true (был false, стал true), обновляем без debounce
      if (prevIsReady === false && isReady === true) {
        void requestAggregatedRecompute('initial-ready', { debounceMs: 0 })
        return
      }
      // Иначе используем обычный debounce
      void requestAggregatedRecompute('filters-changed', { debounceMs: 200 })
    },
    { immediate: true }
  )

  /**
   * Геттер: общие итоги за выбранный период (использует aggregatedReport для расчета)
   */
  const totalSummary = computed(() => {
    const report = aggregatedReport.value

    if (report.length === 0) {
      return {
        totalOrdersCount: 0,
        totalOrdersSum: 0,
        totalDeliveryCount: 0,
        totalCancelCount: 0,
        totalReturnsCount: 0,
        totalSalesCount: 0,
        totalNetSalesCount: 0,
        totalRevenue: 0,
        totalNetRevenue: 0,
        totalRevenueAfterSpp: 0,
        totalSellerAmount: 0,
        totalBuyoutPercent: 0,
        totalSppAmount: 0,
        totalSppPercent: 0,
        totalTransferAmount: 0,
        totalCommissionAmount: 0,
        totalCommissionPercent: 0,
        totalLogistics: 0,
        totalAdvCosts: 0,
        totalDrrSales: 0,
        totalDrrOrders: 0,
        totalDrrOrdersForecast: 0,
        totalPenaltiesCosts: 0,
        totalStorageCosts: 0,
        totalAcceptanceCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
      }
    }

    // Суммируем все показатели по всем артикулам
    const totals = report.reduce(
      (acc, product) => {
        acc.totalOrdersCount += product.ordersCount
        acc.totalOrdersSum += product.ordersSum
        acc.totalDeliveryCount += product.deliveryCount
        acc.totalCancelCount += product.cancelCount
        // Вычисляем salesCount и returnsCount из sizes, так как они не в интерфейсе ProductAggregate
        const productSalesCount = product.sizes.reduce((sum, size) => sum + size.salesCount, 0)
        const productReturnsCount = product.sizes.reduce((sum, size) => sum + size.returnsCount, 0)
        acc.totalReturnsCount += productReturnsCount
        acc.totalSalesCount += productSalesCount
        acc.totalNetSalesCount += product.netSalesCount
        acc.totalRevenue += product.revenue
        acc.totalNetRevenue += product.netRevenue
        acc.totalRevenueAfterSpp += product.revenueAfterSpp
        acc.totalSellerAmount += product.sellerAmount
        acc.totalSppAmount += product.sppAmount
        acc.totalTransferAmount += product.transferAmount
        acc.totalCommissionAmount += product.commissionAmount
        acc.totalLogistics += product.logisticsCosts
        acc.totalAdvCosts += product.advCosts
        acc.totalPenaltiesCosts += product.penaltiesCosts
        acc.totalUnitCosts += product.unitCosts
        acc.totalTaxes += product.taxes
        acc.totalProfit += product.profit
        return acc
      },
      {
        totalOrdersCount: 0,
        totalOrdersSum: 0,
        totalDeliveryCount: 0,
        totalCancelCount: 0,
        totalReturnsCount: 0,
        totalSalesCount: 0,
        totalNetSalesCount: 0,
        totalRevenue: 0,
        totalNetRevenue: 0,
        totalRevenueAfterSpp: 0,
        totalSellerAmount: 0,
        totalBuyoutPercent: 0,
        totalSppAmount: 0,
        totalSppPercent: 0,
        totalTransferAmount: 0,
        totalCommissionAmount: 0,
        totalCommissionPercent: 0,
        totalLogistics: 0,
        totalAdvCosts: 0,
        totalDrrSales: 0,
        totalDrrOrders: 0,
        totalDrrOrdersForecast: 0,
        totalPenaltiesCosts: 0,
        totalStorageCosts: 0,
        totalAcceptanceCosts: 0,
        totalUnitCosts: 0,
        totalTaxes: 0,
        totalProfit: 0,
      }
    )

    // Используем computed для затрат на хранение и приемку
    totals.totalStorageCosts = storageCostsSumByRange.value
    totals.totalAcceptanceCosts = acceptanceCostsSumByRange.value

    // Вычисляем средний процент выкупа по всему магазину
    totals.totalBuyoutPercent = totals.totalDeliveryCount > 0 
      ? (totals.totalNetSalesCount / totals.totalDeliveryCount) * 100 
      : 0

    // Вычисляем средний процент СПП по всему магазину
    totals.totalSppPercent = totals.totalNetRevenue > 0
      ? (totals.totalSppAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний процент комиссии по всему магазину
    totals.totalCommissionPercent = totals.totalNetRevenue > 0
      ? (totals.totalCommissionAmount / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний ДРР по продажам: (totalAdvCosts / totalNetRevenue) * 100
    totals.totalDrrSales = totals.totalNetRevenue > 0
      ? (totals.totalAdvCosts / totals.totalNetRevenue) * 100
      : 0

    // Вычисляем средний ДРР по заказам: (totalAdvCosts / totalOrdersSum) * 100
    totals.totalDrrOrders = totals.totalOrdersSum > 0
      ? (totals.totalAdvCosts / totals.totalOrdersSum) * 100
      : 0

    // Вычисляем средний ДРР прогнозный: (totalAdvCosts / (totalOrdersSum * totalBuyoutPercent / 100)) * 100
    const totalPredictedRevenue = totals.totalOrdersSum > 0 && totals.totalBuyoutPercent > 0
      ? totals.totalOrdersSum * (totals.totalBuyoutPercent / 100)
      : 0
    totals.totalDrrOrdersForecast = totalPredictedRevenue > 0
      ? (totals.totalAdvCosts / totalPredictedRevenue) * 100
      : 0

    // Формула прибыли: Перечисления - Логистика - Хранение - Реклама - Налог - Себестоимость
    // Примечание: totalProfit уже суммируется из product.profit в reduce выше
    // Это обеспечивает согласованность с расчетом на уровне продуктов/размеров

    return totals
  })

  /**
   * Устанавливает фильтры для агрегации
   */
  const setFilters = (dateFrom: string | null, dateTo: string | null) => {
    filters.value.dateFrom = dateFrom
    filters.value.dateTo = dateTo
  }

  /**
   * Загружает поставки из API и сохраняет их в БД
   * @param dateFrom Начальная дата (YYYY-MM-DD)
   * @param dateTo Конечная дата (YYYY-MM-DD)
   */
  const loadSupplies = async (dateFrom: string, dateTo: string) => {
    if (!supplyService) {
      throw new Error('SupplyService not initialized')
    }
    const count = await supplyService.loadSuppliesFromApi(dateFrom, dateTo)
    
    // Перезагружаем поставки в стор после синхронизации
    const allSupplies = await supplyService.getAllSupplies()
    supplies.value = allSupplies
    
    // Автоматически обновляем агрегированный отчёт после изменения поставок
    void requestAggregatedRecompute('supplies-loaded', { debounceMs: 300 })
    
    // Логируем поставки с себестоимостью после перезагрузки
    const reloadedSuppliesWithCosts = getSuppliesWithCosts(allSupplies)
    
    console.log(`[AnalyticsStore] loadSupplies: после синхронизации загружено поставок=${allSupplies.length}, с себестоимостью=${reloadedSuppliesWithCosts.length}`)
    if (reloadedSuppliesWithCosts.length > 0) {
      console.log(`[AnalyticsStore] loadSupplies: поставки с себестоимостью:`, reloadedSuppliesWithCosts)
    }
    
    return count
  }

  /**
   * Получает все поставки, отсортированные по дате приемки (от новых к старым)
   * @returns Promise с массивом поставок
   */
  const getAllSupplies = async (): Promise<ISupply[]> => {
    if (!supplyService) {
      throw new Error('SupplyService not initialized')
    }
    return supplyService.getAllSupplies()
  }

  /**
   * Получает поставки по артикулу WB
   * @param nmId Артикул WB
   * @returns Массив поставок, содержащих данный артикул
   */
  const getSupplyByNmId = async (nmId: number): Promise<ISupply[]> => {
    if (!supplyService) {
      throw new Error('SupplyService not initialized')
    }
    return supplyService.getSupplyByNmId(nmId)
  }

  /**
   * Обновляет глобальную налоговую ставку
   */
  const updateGlobalTax = async (val: number) => {
    if (!dataLoadingService) {
      throw new Error('DataLoadingService not initialized')
    }
    globalTaxRate.value = val
    await dataLoadingService.saveGlobalTaxRate(val)
  }

  /**
   * Обновляет себестоимость товара в поставке
   * @param supplyID ID поставки
   * @param nmID Артикул WB
   * @param techSize Размер товара
   * @param newCost Новая себестоимость (или undefined для удаления)
   */
  const updateSupplyItemCost = async (
    supplyID: number,
    nmID: number,
    techSize: string,
    newCost: number | undefined
  ): Promise<void> => {
    if (!supplyService) {
      throw new Error('SupplyService not initialized')
    }

    console.log(`[AnalyticsStore] updateSupplyItemCost: начало, supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}, newCost=${newCost}`)
    console.log(`[AnalyticsStore] updateSupplyItemCost: текущее состояние supplies.value.length=${supplies.value.length}`)

    await supplyService.updateSupplyItemCost(supplyID, nmID, techSize, newCost)

    // Обновляем supplies в state
    const index = supplies.value.findIndex(s => s.supplyID === supplyID)
    console.log(`[AnalyticsStore] updateSupplyItemCost: индекс поставки в стор=${index}`)
    
    if (index !== -1) {
      const updatedSupply = await supplyService.getAllSupplies().then(supplies =>
        supplies.find(s => s.supplyID === supplyID)
      )
      
      if (updatedSupply) {
        const item = updatedSupply.items.find(item => item.nmID === nmID && item.techSize === techSize)
        console.log(`[AnalyticsStore] updateSupplyItemCost: загружена обновленная поставка, cost в item=${item?.cost}`)
        
        supplies.value[index] = updatedSupply
        
        // Автоматически обновляем агрегированный отчёт после изменения себестоимости
        void requestAggregatedRecompute('supply-cost-updated', { debounceMs: 300 })
        
        // Проверяем, что значение попало в стор
        const checkItem = supplies.value[index].items.find(item => item.nmID === nmID && item.techSize === techSize)
        console.log(`[AnalyticsStore] updateSupplyItemCost: проверка стор, cost в supplies.value=${checkItem?.cost}`)
        
        // Логируем все items в этой поставке с их cost
        console.log(`[AnalyticsStore] updateSupplyItemCost: все items в поставке ${supplyID}:`, 
          updatedSupply.items.map(item => ({ nmID: item.nmID, techSize: item.techSize, cost: item.cost }))
        )
      } else {
        console.warn(`[AnalyticsStore] updateSupplyItemCost: обновленная поставка не найдена после сохранения`)
      }
    } else {
      console.warn(`[AnalyticsStore] updateSupplyItemCost: поставка не найдена в стор`)
    }
  }

  /**
   * Применяет цены из закупки к поставке
   * Находит товары по nmID и применяет себестоимость из закупки
   * @param purchaseID ID закупки
   * @param supplyID ID поставки
   */
  const applyPurchaseToSupply = async (
    purchaseID: number,
    supplyID: number
  ): Promise<void> => {
    if (!supplyService) {
      throw new Error('SupplyService not initialized')
    }
    await supplyService.applyPurchaseToSupply(purchaseID, supplyID)
  }

  return {
    // State
    sales,
    returns,
    logistics,
    penalties,
    advCosts,
    storageCosts,
    acceptanceCosts,
    productOrders,
    productCards,
    unitCosts,
    warehouseRemains,
    supplies,
    isInitialLoading,
    isHistoryLoading,
    isReady,
    filters,
    globalTaxRate,
    backfillProgress,
    dataFreshness,
    weeklyReportReadiness,
    weeklyReportAutoSync,
    startupLogs,
    addStartupLog,
    // Actions
    initializeServices,
    loadAllDataFromDb,
    setFilters,
    updateGlobalTax,
    loadSupplies,
    getSupplyByNmId,
    getAllSupplies,
    updateSupplyItemCost,
    applyPurchaseToSupply,
    requestAggregatedRecompute,
    freezeAggregatedRecompute,
    thawAggregatedRecompute,
    forceRecomputeAggregatedReport,
    // Getters
    totalRecordsCount,
    aggregatedReport,
    aggregateReportForPeriod,
    totalSummary,
    isAggregatedReportDirty,
    isAggregatedReportUpdating,
    isAggregating,
    storageCostsSumByRange,
    acceptanceCostsSumByRange,
  }
})
