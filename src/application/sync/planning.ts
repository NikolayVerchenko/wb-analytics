import type { DatasetKey, Checkpoint } from './types'
import type { SyncPlan } from './SyncJob'
import type { DatasetPolicy } from './SyncPolicy'
import { addDays, defaultHighWatermark, isoDateOnly } from './date'
import { getWeekRange, isWeekClosed, getPreviousWeekRange } from './calendar'

/**
 * Прогресс выполнения backfill для sales
 */
export type BackfillProgress = {
  lowerBound: string
  currentWeek?: { from: string; to: string } // неделя, которую планируем/грузим в этом тике (если есть)
  weeksDone: number
  weeksRemaining: number
  percent: number // 0..100
  completed: boolean
}

type PlanInput = {
  dataset: DatasetKey
  policy: DatasetPolicy
  nowIso: string
  checkpoint: Checkpoint | null
}

/**
 * Вычисляет нижнюю границу истории (не глубже maxHistoryDays).
 */
const clampHistoryStart = (high: string, maxHistoryDays: number | null): string | null => {
  if (!maxHistoryDays) return null
  return addDays(high, -maxHistoryDays)
}

/**
 * PRIORITY: последние policy.priorityDays (быстро для UI)
 * Возвращает plan с mode='refresh' (по сути "перезалив" последних дней)
 */
export const buildPriorityPlan = (inp: PlanInput): SyncPlan => {
  const high = defaultHighWatermark(inp.nowIso)
  const from = addDays(high, -inp.policy.priorityDays + 1)
  return {
    dataset: inp.dataset,
    mode: 'refresh',
    overlapDays: inp.policy.refreshOverlapDays,
    range: { from, to: high },
    syncMode: 'daily',
  }
}

/**
 * REFRESH: небольшой overlap около highWatermark (плавающие данные)
 * Например, последние 3-7 дней.
 */
export const buildRefreshPlan = (inp: PlanInput): SyncPlan => {
  const high = defaultHighWatermark(inp.nowIso)
  const from = addDays(high, -inp.policy.refreshOverlapDays + 1)
  return {
    dataset: inp.dataset,
    mode: 'refresh',
    overlapDays: inp.policy.refreshOverlapDays,
    range: { from, to: high },
    syncMode: 'daily',
  }
}

/**
 * Builds sync plan for sales dataset with calendar-aware daily/weekly logic
 * 
 * Logic:
 * - Always plan DAILY for current week
 * - If previous week is closed (Mon/Tue) → add WEEKLY plan for that week
 * 
 * Returns array of plans (daily + optional weekly)
 */
export const buildSalesPlan = (
  dataset: DatasetKey,
  policy: DatasetPolicy,
  checkpoint: Checkpoint | null,
  today: Date
): SyncPlan[] => {
  const todayIso = isoDateOnly(today)
  const high = defaultHighWatermark(todayIso)
  const plans: SyncPlan[] = []

  // 1. Always plan DAILY for current/priority period
  const from = addDays(high, -policy.priorityDays + 1)
  plans.push({
    dataset,
    mode: 'refresh',
    overlapDays: policy.refreshOverlapDays,
    range: { from, to: high },
    syncMode: 'daily',
  })

  // 2. Check if previous week is closed and needs weekly reload
  const prevWeekRange = getPreviousWeekRange(today)
  const prevWeekStart = prevWeekRange.from

  if (isWeekClosed(prevWeekStart, today)) {
    // Check if weekly reload was already done
    // We check if checkpoint cursorTime is >= prev week's Sunday
    if (!checkpoint?.cursorTime || checkpoint.cursorTime < prevWeekRange.to) {
      plans.push({
        dataset,
        mode: 'refresh',
        range: prevWeekRange,
        syncMode: 'weekly',
      })
    }
  }

  return plans
}

/**
 * CATCHUP: догоняем историю чанками, используя checkpoint.cursorTime
 * cursorTime = "до какой даты мы уже дособрали" (включительно)
 *
 * Логика:
 * - Если checkpoint есть: start = cursorTime + 1 день (следующий день после последней загруженной даты)
 * - Если checkpoint нет: start = minStart ?? (high - 365 дней)
 * - берем chunkDays вперед: [start .. min(start+chunkDays-1, high)]
 * - если start > high => null (догнали)
 */
export const buildCatchupPlan = (inp: PlanInput): SyncPlan | null => {
  const high = defaultHighWatermark(inp.nowIso)
  const minStart = clampHistoryStart(high, inp.policy.maxHistoryDays)

  // Если checkpoint есть, начинаем со следующего дня после cursorTime
  // Если checkpoint нет, начинаем с minStart или с high - 365 дней
  const start = inp.checkpoint?.cursorTime 
    ? addDays(inp.checkpoint.cursorTime, 1) // Следующий день после последней загруженной даты
    : (minStart ?? addDays(high, -365))
  
  console.log(`[buildCatchupPlan] dataset=${inp.dataset}, checkpoint.cursorTime=${inp.checkpoint?.cursorTime || 'null'}, start=${start}, high=${high}, minStart=${minStart || 'null'}`)
  
  if (start > high) {
    console.log(`[buildCatchupPlan] dataset=${inp.dataset}: start (${start}) > high (${high}), возвращаем null (догнали)`)
    return null
  }

  // если есть ограничение по истории — не идем раньше minStart
  const from = minStart ? (start < minStart ? minStart : start) : start
  if (from > high) {
    console.log(`[buildCatchupPlan] dataset=${inp.dataset}: from (${from}) > high (${high}), возвращаем null`)
    return null
  }

  const to = addDays(from, inp.policy.catchupChunkDays - 1)
  const clampedTo = to > high ? high : to

  console.log(`[buildCatchupPlan] dataset=${inp.dataset}: план создан, период ${from} - ${clampedTo}`)

  return {
    dataset: inp.dataset,
    mode: 'catchup',
    range: { from, to: clampedTo },
    syncMode: 'daily',
  }
}

/**
 * Возвращает последнюю закрытую неделю для backfill
 * Используется как стартовая точка для backfill
 * 
 * Логика:
 * - Если предыдущая неделя закрыта (сегодня Пн-Сб, не воскресенье) → возвращаем её
 * - Иначе возвращаем позапрошлую неделю
 * - В воскресенье возвращает null (неделя ещё не закрыта)
 */
export const getLastClosedWeek = (today: Date): { from: string; to: string } | null => {
  const day = today.getDay()
  
  // В воскресенье неделя ещё не закрыта
  if (day === 0) {
    return null
  }
  
  const prevWeek = getPreviousWeekRange(today)
  
  // Если предыдущая неделя закрыта (сегодня Пн-Сб) → берём её
  if (isWeekClosed(prevWeek.from, today)) {
    return prevWeek
  }
  
  // Иначе берём позапрошлую неделю
  const prevWeekStart = new Date(prevWeek.from)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  return getWeekRange(isoDateOnly(prevWeekStart))
}

/**
 * Вычисляет количество недель между двумя датами (понедельниками)
 * Считает строго по 7 дней, включая обе границы
 */
const countWeeksBetween = (fromMonday: string, toMonday: string): number => {
  const from = new Date(fromMonday)
  const to = new Date(toMonday)
  const diffMs = to.getTime() - from.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1 // +1 чтобы включить обе границы
}

/**
 * Вычисляет прогресс backfill для sales
 */
export const getSalesBackfillProgress = (
  checkpoint: Checkpoint | null,
  today: Date,
  lowerBound = '2024-01-29'
): BackfillProgress => {
  // 1) Определяем последнюю закрытую неделю (стартовую точку backfill)
  const startWeek = getLastClosedWeek(today)
  
  if (!startWeek) {
    // В воскресенье неделя ещё не закрыта
    return {
      lowerBound,
      weeksDone: 0,
      weeksRemaining: 0,
      percent: 0,
      completed: false,
    }
  }
  
  // 2) weeksDone: количество недель от checkpoint.cursorTime (воскресенье) до startWeek.to (воскресенье) включительно
  //    Если checkpoint.cursorTime == startWeek.to, то weeksDone = 1 (загружена одна неделя - стартовая)
  let weeksDone = 0
  if (checkpoint?.cursorTime) {
    // checkpoint.cursorTime хранит "to" (воскресенье) последней загруженной недели
    const checkpointWeek = getWeekRange(checkpoint.cursorTime)
    // Считаем недели от checkpointWeek.from (понедельник) до startWeek.from (понедельник) включительно
    weeksDone = countWeeksBetween(checkpointWeek.from, startWeek.from)
  }
  
  // 3) weeksTotal: количество недель от lowerBound (понедельник) до startWeek.from (понедельник) включительно
  const weeksTotal = countWeeksBetween(lowerBound, startWeek.from)
  
  // 4) weeksRemaining = max(weeksTotal - weeksDone, 0)
  const weeksRemaining = Math.max(weeksTotal - weeksDone, 0)
  
  // 5) percent = weeksTotal === 0 ? 100 : round((weeksDone/weeksTotal)*100)
  const percent = weeksTotal === 0 ? 100 : Math.round((weeksDone / weeksTotal) * 100)
  
  // 6) completed = weeksRemaining === 0
  const completed = weeksRemaining === 0
  
  return {
    lowerBound,
    weeksDone,
    weeksRemaining,
    percent,
    completed,
  }
}

/**
 * BACKFILL для sales: загрузка истории назад по полным неделям (Пн–Вс)
 * 
 * Логика:
 * - Движется назад от последней закрытой недели
 * - Останавливается на lowerBound (policy.backfillLowerBound или '2024-01-29')
 * - Не загружает данные позже upperBound (defaultHighWatermark)
 * - Использует syncMode: 'weekly' для загрузки полных недель
 * - Если checkpoint отсутствует → берём последнюю закрытую неделю (не текущую)
 * - Если checkpoint есть → берём неделю ПЕРЕД checkpoint.cursorTime
 */
export const buildSalesBackfillPlan = (
  policy: DatasetPolicy,
  checkpoint: Checkpoint | null,
  today: Date
): SyncPlan | null => {
  const todayIso = isoDateOnly(today)
  const upperBound = defaultHighWatermark(todayIso)
  const lowerBound = policy.backfillLowerBound || '2024-01-29'
  let targetWeek: { from: string; to: string }

  console.log(`[buildSalesBackfillPlan] checkpoint=${checkpoint ? `cursorTime=${checkpoint.cursorTime}` : 'null'}, upperBound=${upperBound}, lowerBound=${lowerBound}`)

  if (!checkpoint) {
    // Нет checkpoint → определяем последнюю закрытую неделю
    const startWeek = getLastClosedWeek(today)
    if (!startWeek) {
      console.log(`[buildSalesBackfillPlan] нет checkpoint и нет закрытой недели (сегодня воскресенье?), возвращаем null`)
      return null
    }
    targetWeek = startWeek
    console.log(`[buildSalesBackfillPlan] нет checkpoint, используем стартовую неделю: ${targetWeek.from} - ${targetWeek.to}`)
  } else {
    // Есть checkpoint → берём неделю ПЕРЕД checkpoint.cursorTime
    // checkpoint.cursorTime хранит "to" (воскресенье) последней загруженной недели
    if (!checkpoint.cursorTime) {
      console.log(`[buildSalesBackfillPlan] checkpoint есть, но cursorTime отсутствует, возвращаем null`)
      return null
    }

    const weekOfCursor = getWeekRange(checkpoint.cursorTime)
    const prevWeekStart = addDays(weekOfCursor.from, -7)
    const prevWeekEnd = addDays(weekOfCursor.to, -7)
    
    targetWeek = {
      from: prevWeekStart,
      to: prevWeekEnd,
    }
    console.log(`[buildSalesBackfillPlan] checkpoint.cursorTime=${checkpoint.cursorTime}, неделя курсора: ${weekOfCursor.from} - ${weekOfCursor.to}, следующая неделя назад: ${targetWeek.from} - ${targetWeek.to}`)
  }

  // Проверка upperBound: не загружаем данные позже defaultHighWatermark
  if (targetWeek.to > upperBound) {
    console.log(`[buildSalesBackfillPlan] targetWeek.to (${targetWeek.to}) > upperBound (${upperBound}), возвращаем null`)
    return null
  }

  // Строго полные недели: если from < lowerBound → останавливаемся
  if (targetWeek.from < lowerBound) {
    console.log(`[buildSalesBackfillPlan] targetWeek.from (${targetWeek.from}) < lowerBound (${lowerBound}), backfill завершен, возвращаем null`)
    return null
  }

  console.log(`[buildSalesBackfillPlan] план создан, неделя ${targetWeek.from} - ${targetWeek.to}`)
  return {
    dataset: 'sales',
    mode: 'backfill',
    range: targetWeek,
    syncMode: 'weekly',
  }
}
