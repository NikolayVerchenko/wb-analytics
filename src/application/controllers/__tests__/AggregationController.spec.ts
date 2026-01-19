/**
 * Псевдотесты для AggregationController
 * Описывают ключевые сценарии для проверки корректности работы контроллера
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AggregationController, type FreezeBehavior } from '../AggregationController'

describe('AggregationController', () => {
  let controller: AggregationController<'test-reason'>
  let runMock: ReturnType<typeof vi.fn>
  let onInvalidateMock: ReturnType<typeof vi.fn>
  let onBatchCompletedMock: ReturnType<typeof vi.fn>
  let onRunScheduledMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    runMock = vi.fn().mockResolvedValue(undefined)
    onInvalidateMock = vi.fn()
    onBatchCompletedMock = vi.fn()
    onRunScheduledMock = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Debounce cancel без deadlock', () => {
    it('Тест 1: debounce не зависает при отмене', async () => {
      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        undefined,
        undefined,
        { freezeBehavior: 'block-new-only', invalidateOnRequest: false }
      )

      const requestA = controller.request('reason-a', { debounceMs: 200 })
      await vi.advanceTimersByTimeAsync(50)
      const requestB = controller.request('reason-b', { debounceMs: 200 })

      // Промотаем время до завершения debounce
      await vi.advanceTimersByTimeAsync(200)

      // Оба request должны завершиться без зависания
      await Promise.all([requestA, requestB])

      // run должен быть вызван (обычно 1 раз, так как второй отменяет первый)
      expect(runMock).toHaveBeenCalled()
      expect(runMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Batch-aware: pending очищаются только после последнего request', () => {
    it('Тест 2: batch-aware очистка pending', async () => {
      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        undefined,
        onBatchCompletedMock,
        { freezeBehavior: 'block-new-only', invalidateOnRequest: false }
      )

      // Запускаем несколько request подряд
      const requestA = controller.request('reason-a', { debounceMs: 0 })
      const requestB = controller.request('reason-b', { debounceMs: 0 })
      const requestC = controller.request('reason-c', { debounceMs: 0 })

      await Promise.all([requestA, requestB, requestC])

      // onBatchCompleted должен быть вызван один раз
      expect(onBatchCompletedMock).toHaveBeenCalledTimes(1)
      // pending должны быть очищены
      expect(controller.getPending().length).toBe(0)
    })
  })

  describe('Freeze во время debounce: run не стартует, pending сохраняются', () => {
    it('Тест 3: freeze накопление pending', async () => {
      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        undefined,
        undefined,
        { freezeBehavior: 'block-new-only', invalidateOnRequest: false }
      )

      const requestA = controller.request('reason-a', { debounceMs: 200 })
      await vi.advanceTimersByTimeAsync(50)

      // Замораживаем во время debounce
      controller.freeze()

      // Промотаем время
      await vi.advanceTimersByTimeAsync(200)
      await requestA

      // run не должен был вызваться
      expect(runMock).not.toHaveBeenCalled()
      // pending должен содержать reason-a
      expect(controller.getPending()).toContain('reason-a')
      expect(controller.getFrozen()).toBe(true)
    })
  })

  describe('Thaw: один пересчёт и очистка pending', () => {
    it('Тест 4: thaw запускает пересчёт', async () => {
      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        undefined,
        undefined,
        { freezeBehavior: 'block-new-only', invalidateOnRequest: false }
      )

      controller.freeze()
      controller.request('reason-a', { debounceMs: 0 })
      controller.request('reason-b', { debounceMs: 0 })
      controller.request('reason-c', { debounceMs: 0 })

      // Размораживаем
      controller.thaw()

      // Ждём завершения
      await vi.runAllTimersAsync()

      // run должен быть вызван 1 раз
      expect(runMock).toHaveBeenCalledTimes(1)
      // pending должны быть очищены после пересчёта
      expect(controller.getPending().length).toBe(0)
    })
  })

  describe('FreezeBehavior: block-commit', () => {
    it('Тест 5: block-commit — коммит не происходит при freeze', async () => {
      let canCommitValue = true
      let committed = false

      runMock = vi.fn().mockImplementation(async (reason, runId, canCommit) => {
        // Симулируем долгий run
        await new Promise(resolve => setTimeout(resolve, 100))
        if (canCommit()) {
          committed = true
        }
      })

      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        undefined,
        undefined,
        { freezeBehavior: 'block-commit', invalidateOnRequest: false }
      )

      const requestPromise = controller.request('reason-a', { debounceMs: 0 })
      await vi.advanceTimersByTimeAsync(50)

      // Замораживаем во время выполнения run
      controller.freeze()

      await vi.advanceTimersByTimeAsync(100)
      await requestPromise

      // run был вызван, но коммит не произошёл
      expect(runMock).toHaveBeenCalled()
      expect(committed).toBe(false)
    })
  })

  describe('InvalidateOnRequest: старый run не коммитит после нового request', () => {
    it('Тест 6: invalidateOnRequest=true — старый run не коммитит', async () => {
      let latestRunId = 0
      let committedRunId: number | null = null

      runMock = vi.fn().mockImplementation(async (reason, runId, canCommit) => {
        // Симулируем долгий run
        await new Promise(resolve => setTimeout(resolve, 200))
        if (runId === latestRunId && canCommit()) {
          committedRunId = runId
        }
      })

      onRunScheduledMock = vi.fn().mockImplementation((runId: number) => {
        latestRunId = runId
      })

      controller = new AggregationController(
        () => true,
        onInvalidateMock,
        runMock,
        onRunScheduledMock,
        undefined,
        { freezeBehavior: 'block-new-only', invalidateOnRequest: true }
      )

      // Запускаем первый request (долгий)
      const requestA = controller.request('reason-a', { debounceMs: 0 })
      await vi.advanceTimersByTimeAsync(50)

      // Запускаем второй request (он должен инвалидировать первый)
      const requestB = controller.request('reason-b', { debounceMs: 0 })

      await vi.advanceTimersByTimeAsync(200)
      await Promise.all([requestA, requestB])

      // onRunScheduled должен быть вызван для обоих runs
      expect(onRunScheduledMock).toHaveBeenCalledTimes(2)
      // Коммит должен произойти только для последнего runId
      expect(committedRunId).toBe(latestRunId)
      expect(committedRunId).not.toBe(1) // Первый run не должен коммитить
    })
  })
})
