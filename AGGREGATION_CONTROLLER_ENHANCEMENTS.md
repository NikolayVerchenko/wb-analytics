# Улучшения AggregationController

## Обзор изменений

Добавлены два опциональных поведения для более гибкого управления пересчётом агрегированного отчёта:

1. **freezeBehavior** — контроль поведения при freeze
2. **invalidateOnRequest** — мгновенная инвалидация текущего run при новом request

## Изменения в AggregationController.ts

### Новые типы и интерфейсы

```typescript
export type FreezeBehavior = 'block-new-only' | 'block-commit'

export interface AggregationControllerOptions {
  freezeBehavior?: FreezeBehavior  // по умолчанию 'block-new-only'
  invalidateOnRequest?: boolean    // по умолчанию false
}
```

### Изменения в конструкторе

1. **Новый параметр `canCommit` в `run` callback**:
   ```typescript
   run: (reason: Reason, runId: number, canCommit: () => boolean) => Promise<void>
   ```
   - `canCommit()` возвращает `false` если `freezeBehavior='block-commit'` и контроллер заморожен

2. **Новый опциональный callback `onRunScheduled`**:
   ```typescript
   onRunScheduled?: (runId: number) => void
   ```
   - Вызывается сразу после генерации `currentRunId` (до debounce)
   - Используется для `invalidateOnRequest=true`

3. **Параметр `options`**:
   ```typescript
   options: AggregationControllerOptions = {}
   ```

### Изменения в логике

1. **Метод `canCommit()`**:
   - Проверяет `freezeBehavior === 'block-commit'` и `isFrozen`
   - Возвращает `false` если коммит должен быть заблокирован

2. **В `executeRun()`**:
   - При `invalidateOnRequest=true` вызывается `onRunScheduled(currentRunId)` сразу после генерации runId
   - `canCommit()` передаётся в `run()` callback

## Изменения в analyticsStore.ts

### Обновлённый run callback

```typescript
async (reason: RecomputeReason, runId: number, canCommit: () => boolean) => {
  const myRunId = runId
  
  // Обновление latestRunId зависит от invalidateOnRequest
  if (!invalidateOnRequestEnabled) {
    latestRunId = runId
  }
  
  // ... выполнение aggregateReport ...
  
  // Проверка canCommit перед коммитом
  if (!canCommit()) {
    console.log('пропущен коммит (freezeBehavior="block-commit" и контроллер заморожен)')
    return
  }
  
  aggregatedReportData.value = report
  // ...
}
```

### onRunScheduled callback

```typescript
(runId: number) => {
  // Немедленно обновляем latestRunId при новом request (до debounce)
  latestRunId = runId
}
```

### Инициализация контроллера

```typescript
const aggregationController = new AggregationController<RecomputeReason>(
  // ... callbacks ...
  {
    freezeBehavior: 'block-new-only',  // Можно изменить на 'block-commit'
    invalidateOnRequest: false,         // Можно включить для мгновенной инвалидации
  }
)

invalidateOnRequestEnabled = aggregationController.invalidateOnRequest
```

## Сценарии использования

### Сценарий 1: freezeBehavior="block-commit"

**Проблема**: При freeze уже выполняющийся run может закоммитить результат.

**Решение**: При `freezeBehavior='block-commit'` проверка `canCommit()` блокирует коммит даже для уже выполняющегося run.

**Пример**:
```typescript
controller.request('reason-a', { debounceMs: 0 })
// run начал выполняться...
controller.freeze()  // freezeBehavior='block-commit'
// run завершился, но canCommit() вернул false → коммит не произошёл
```

### Сценарий 2: invalidateOnRequest=true

**Проблема**: Если новый request приходит во время debounce старого, старый run может успеть закоммитить до старта нового.

**Решение**: При `invalidateOnRequest=true` `latestRunId` обновляется немедленно при новом request (до debounce), старый run не может закоммитить.

**Пример**:
```typescript
// invalidateOnRequest=true
controller.request('reason-a', { debounceMs: 200 })
// onRunScheduled(1) вызван → latestRunId = 1
await delay(50)
controller.request('reason-b', { debounceMs: 200 })
// onRunScheduled(2) вызван → latestRunId = 2 (немедленно!)
// Старый run (runId=1) не сможет закоммитить, т.к. latestRunId уже = 2
```

## Тесты

Создан файл `src/application/controllers/__tests__/AggregationController.spec.ts` с тестами:

1. **Тест 1**: Debounce cancel без deadlock
2. **Тест 2**: Batch-aware очистка pending
3. **Тест 3**: Freeze накопление pending
4. **Тест 4**: Thaw запускает пересчёт
5. **Тест 5**: block-commit блокирует коммит
6. **Тест 6**: invalidateOnRequest инвалидирует старый run

## Обратная совместимость

✅ **Публичный API store не изменён**:
- `requestAggregatedRecompute`
- `freezeAggregatedRecompute`
- `thawAggregatedRecompute`
- `forceRecomputeAggregatedReport`
- `isAggregatedReportDirty`
- `isAggregatedReportUpdating`
- `isAggregating`

✅ **Поведение по умолчанию сохранено**:
- `freezeBehavior='block-new-only'` (текущее поведение)
- `invalidateOnRequest=false` (текущее поведение)

## Как включить новые режимы

### Включить block-commit:

```typescript
const aggregationController = new AggregationController<RecomputeReason>(
  // ... callbacks ...
  {
    freezeBehavior: 'block-commit',  // ← изменить здесь
    invalidateOnRequest: false,
  }
)
```

### Включить invalidateOnRequest:

```typescript
const aggregationController = new AggregationController<RecomputeReason>(
  // ... callbacks ...
  {
    freezeBehavior: 'block-new-only',
    invalidateOnRequest: true,  // ← изменить здесь
  }
)
```

## Проверка работы

1. Запустить тесты: `npm test`
2. Проверить TypeScript: `npx tsc --noEmit`
3. Проверить линтер: ошибок не должно быть
