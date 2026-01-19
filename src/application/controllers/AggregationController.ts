/**
 * Контроллер пересчёта агрегированных данных
 * - debounce (c отменой без deadlock)
 * - race-safety (до и после run)
 * - batch-aware pending reasons
 * - freeze/thaw (без потери pending)
 */
export type FreezeBehavior = 'block-new-only' | 'block-commit'

export interface AggregationControllerOptions {
  /**
   * Поведение freeze:
   * - "block-new-only" (по умолчанию) — freeze запрещает новые run, но уже выполняющийся run может закоммитить
   * - "block-commit" — freeze запрещает коммит результата даже для уже выполняющегося run
   */
  freezeBehavior?: FreezeBehavior

  /**
   * Если true, любой новый request() немедленно инвалидирует текущий run ещё до debounce
   */
  invalidateOnRequest?: boolean
}

export class AggregationController<Reason extends string> {
  private pendingReasons: Reason[] = []

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debounceResolve: (() => void) | null = null

  private runId = 0
  private requestId = 0
  private isFrozen = false

  public readonly freezeBehavior: FreezeBehavior
  public readonly invalidateOnRequest: boolean

  constructor(
    private readonly hasPrerequisites: () => boolean,
    private readonly onInvalidate: () => void,

    /**
     * run — выполняет пересчёт и (обычно) пишет результат в store
     * runId передаётся для race-safety: коммит результата должен делать
     * только если runId актуален (проверка через guard в store)
     * canCommit — функция для проверки возможности коммита (учитывает freezeBehavior)
     */
    private readonly run: (reason: Reason, runId: number, canCommit: () => boolean) => Promise<void>,

    /**
     * onRunScheduled — вызывается сразу после генерации нового runId (до debounce)
     * Используется для invalidateOnRequest: позволяет store обновить latestRunId немедленно
     */
    private readonly onRunScheduled?: (runId: number) => void,

    private readonly onBatchCompleted?: (pending: Reason[]) => void,
    options: AggregationControllerOptions = {}
  ) {
    this.freezeBehavior = options.freezeBehavior ?? 'block-new-only'
    this.invalidateOnRequest = options.invalidateOnRequest ?? false
  }

  async request(reason: Reason, opts?: { debounceMs?: number }): Promise<void> {
    this.requestId++
    const localRequestId = this.requestId

    if (!this.pendingReasons.includes(reason)) {
      this.pendingReasons.push(reason)
    }

    if (this.isFrozen) return

    try {
      await this.executeRun(reason, opts?.debounceMs)
    } finally {
      // Batch-aware: onBatchCompleted вызываем всегда для последнего запроса в батче
      // pending очищаем только если не frozen (при frozen они должны копиться до thaw)
      if (localRequestId === this.requestId) {
        this.onBatchCompleted?.([...this.pendingReasons])
        if (!this.isFrozen) {
          this.pendingReasons = []
        }
      }
    }
  }

  private cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    // решаем Promise ожидания debounce, чтобы не было deadlock
    if (this.debounceResolve) {
      this.debounceResolve()
      this.debounceResolve = null
    }
  }

  private canCommit(): boolean {
    // При "block-commit" проверяем frozen состояние
    if (this.freezeBehavior === 'block-commit' && this.isFrozen) {
      return false
    }
    return true
  }

  private async executeRun(reason: Reason, debounceMs: number = 200): Promise<void> {
    if (!this.hasPrerequisites()) {
      // инвалидируем и чистим ожидающий debounce
      this.runId++
      this.onInvalidate()
      this.cancelDebounce()
      return
    }

    const currentRunId = ++this.runId

    // Если invalidateOnRequest включен, уведомляем store о новом runId сразу
    if (this.invalidateOnRequest) {
      this.onRunScheduled?.(currentRunId)
    }

    if (debounceMs > 0) {
      // отменяем предыдущий debounce (и разлочиваем его Promise)
      this.cancelDebounce()

      await new Promise<void>((resolve) => {
        this.debounceResolve = resolve
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null
          this.debounceResolve = null
          resolve()
        }, debounceMs)
      })
    }

    // если за время debounce пришёл новый запуск — выходим
    if (currentRunId !== this.runId) return

    // prerequisites могли стать невалидными во время debounce
    if (!this.hasPrerequisites()) {
      this.runId++
      this.onInvalidate()
      this.cancelDebounce() // для симметрии (debounce уже закончился, но консистентно)
      return
    }

    // если успели заморозить — не запускаем run (для обоих freezeBehavior)
    if (this.isFrozen) return

    // запускаем пересчёт с runId для race-safety (commit guard должен быть внутри run)
    // передаём canCommit для проверки freezeBehavior="block-commit"
    await this.run(reason, currentRunId, () => this.canCommit())

    // race-safety: если за время выполнения пришёл новый запуск — выходим
    // (коммит результата уже защищён guard'ом внутри run, это дополнительная проверка)
    if (currentRunId !== this.runId) return
  }

  freeze(): void {
    this.isFrozen = true
    // отменяем отложенный запуск (и не даём висеть Promise)
    this.cancelDebounce()
  }

  thaw(): void {
    this.isFrozen = false

    // если что-то накопилось — запускаем 1 пересчёт без debounce
    // используем последнюю причину как агрегирующую (представляет все накопленные)
    if (this.pendingReasons.length > 0) {
      const lastReason = this.pendingReasons[this.pendingReasons.length - 1] as Reason
      void this.request(lastReason, { debounceMs: 0 })
    }
  }

  clearPending(): void {
    this.pendingReasons = []
  }

  getPending(): readonly Reason[] {
    return this.pendingReasons
  }

  getFrozen(): boolean {
    return this.isFrozen
  }
}
