/**
 * Calendar helpers for week-aware sync logic
 */

import { isoDateOnly, addDays } from './date'

export type ISODate = string // Format: YYYY-MM-DD

/**
 * Returns the week range (Monday-Sunday) for a given date
 */
export const getWeekRange = (date: ISODate): { from: ISODate; to: ISODate } => {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = day === 0 ? 6 : day - 1 // Monday = 0, Sunday = 6
  
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  return {
    from: isoDateOnly(monday),
    to: isoDateOnly(sunday),
  }
}

/**
 * Checks if a week is considered "closed"
 * Week is closed if:
 * - Today is Monday or later (but not Sunday)
 * - weekStart is the previous week's Monday
 * 
 * В воскресенье возвращает false, чтобы не делать weekly-refresh заранее
 */
export const isWeekClosed = (weekStart: ISODate, today: Date): boolean => {
  const day = today.getDay() // 0 = Sunday, 1 = Monday, 2 = Tuesday, ..., 6 = Saturday
  
  // В воскресенье неделя ещё не закрыта (не делаем weekly-refresh заранее)
  if (day === 0) {
    return false
  }
  
  // Начиная с понедельника текущей недели и дальше (Пн-Сб)
  // неделя считается закрытой по календарю
  const prevWeekRange = getPreviousWeekRange(today)
  
  // Week is closed if weekStart matches previous week's Monday
  return weekStart === prevWeekRange.from
}

/**
 * Returns the previous week's range (Monday-Sunday)
 */
export const getPreviousWeekRange = (today: Date): { from: ISODate; to: ISODate } => {
  const day = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to previous Sunday
  let daysToSunday: number
  if (day === 0) {
    // Sunday - 7 days back
    daysToSunday = 7
  } else if (day === 1) {
    // Monday - 1 day back (yesterday = Sunday)
    daysToSunday = 1
  } else if (day === 2) {
    // Tuesday - 2 days back (day before yesterday = Sunday)
    daysToSunday = 2
  } else {
    // Wednesday-Saturday - day days back
    daysToSunday = day
  }
  
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - daysToSunday)
  
  // Calculate Monday of that week (6 days before Sunday)
  const monday = new Date(sunday)
  monday.setDate(sunday.getDate() - 6)
  
  return {
    from: isoDateOnly(monday),
    to: isoDateOnly(sunday),
  }
}

/**
 * Result of building weeks array
 */
export type WeeksArray = {
  fullWeeks: Array<{ from: ISODate; to: ISODate }>
  incompleteWeek?: { from: ISODate; to: ISODate }
}

export type SyncRange = {
  from: ISODate
  to: ISODate
  syncMode: 'weekly' | 'daily'
}

/**
 * Builds an array of full weeks (Monday-Sunday) from today backwards to lowerBound.
 * Separately saves the last incomplete week (if today is not Sunday).
 * 
 * Follows SOLID principles:
 * - SRP: Only responsible for building weeks array
 * - DIP: Depends only on abstractions (utilities from calendar.ts and date.ts)
 * - OCP: Extensible through parameters
 * 
 * @param today - Current date
 * @param lowerBound - Lower bound date (default: '2024-01-29')
 * @returns Object with fullWeeks array and optional incompleteWeek
 */
export const buildWeeksArray = (
  today: Date,
  lowerBound: ISODate = '2024-01-29'
): WeeksArray => {
  const todayIso = isoDateOnly(today)
  const todayWeek = getWeekRange(todayIso)
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  const result: WeeksArray = {
    fullWeeks: [],
  }
  
  // Determine starting week
  let currentWeekStart: ISODate
  
  if (dayOfWeek === 0) {
    // Sunday - текущая неделя технически завершена, но данные могут еще обновляться
    // Поэтому считаем её неполной и загружаем в daily режиме
    result.incompleteWeek = todayWeek
    // Start from previous week
    const prevWeek = getPreviousWeekRange(today)
    currentWeekStart = prevWeek.from
  } else {
    // Not Sunday - current week is incomplete
    result.incompleteWeek = todayWeek
    // Start from previous week
    const prevWeek = getPreviousWeekRange(today)
    currentWeekStart = prevWeek.from
  }
  
  // Build array of full weeks, moving backwards
  let weekStart = currentWeekStart
  
  while (weekStart >= lowerBound) {
    const weekEnd = addDays(weekStart, 6) // Sunday
    result.fullWeeks.push({
      from: weekStart,
      to: weekEnd,
    })
    
    // Move to previous week
    weekStart = addDays(weekStart, -7)
  }
  
  return result
}

export const buildSyncRangesForWindow = (start: ISODate, end: ISODate): SyncRange[] => {
  if (start > end) {
    return []
  }

  const ranges: SyncRange[] = []
  let cursor = start

  while (cursor <= end) {
    const week = getWeekRange(cursor)

    if (cursor === week.from && week.to <= end) {
      ranges.push({ from: week.from, to: week.to, syncMode: 'weekly' })
      cursor = addDays(week.to, 1)
      continue
    }

    const to = week.to < end ? week.to : end
    ranges.push({ from: cursor, to, syncMode: 'daily' })
    cursor = addDays(to, 1)
  }

  return ranges
}
