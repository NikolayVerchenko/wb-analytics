export const isoDateOnly = (d: Date): string => d.toISOString().split('T')[0]

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return isoDateOnly(d)
}

/**
 * highWatermark: "вчера" (чтобы не трогать сегодняшний день, который может меняться)
 */
export const defaultHighWatermark = (nowIso: string): string => {
  const d = new Date(nowIso)
  d.setDate(d.getDate() - 1)
  return isoDateOnly(d)
}

/**
 * Возвращает дату понедельника для указанной даты
 * Если дата уже понедельник - возвращает её
 */
export const weekStartMonday = (iso: string): string => {
  const d = new Date(iso)
  const day = d.getDay() // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  const diff = day === 0 ? 6 : day - 1 // Понедельник = 0, воскресенье = 6
  d.setDate(d.getDate() - diff)
  return isoDateOnly(d)
}

/**
 * Возвращает диапазон последней закрытой недели (пн-вс)
 * Например, если сегодня среда - возвращает пн-вс предыдущей недели
 * Если сегодня понедельник - возвращает пн-вс предыдущей недели
 */
export const lastClosedWeekRange = (todayIso: string): { from: string; to: string } => {
  const today = new Date(todayIso)
  const day = today.getDay() // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  
  // Вычисляем воскресенье предыдущей недели (последний день закрытой недели)
  // Если понедельник (1) или вторник (2) - возвращаем предыдущую неделю
  // Если среда-воскресенье (3-0) - возвращаем предыдущую неделю
  let daysToSunday: number
  if (day === 0) {
    // Воскресенье - 7 дней назад
    daysToSunday = 7
  } else if (day === 1) {
    // Понедельник - 1 день назад (вчера - воскресенье)
    daysToSunday = 1
  } else if (day === 2) {
    // Вторник - 2 дня назад (позавчера - воскресенье)
    daysToSunday = 2
  } else {
    // Среда-суббота - day дней назад
    daysToSunday = day
  }
  
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - daysToSunday)
  
  // Вычисляем понедельник той же недели (6 дней назад от воскресенья)
  const monday = new Date(sunday)
  monday.setDate(sunday.getDate() - 6)
  
  return {
    from: isoDateOnly(monday),
    to: isoDateOnly(sunday),
  }
}

/**
 * Проверяет, находимся ли мы в окне weekly rebuild (понедельник или вторник)
 * Weekly refresh выполняется в Пн/Вт для предыдущей закрытой недели
 */
export const isWeeklyRebuildWindow = (todayIso: string): boolean => {
  const d = new Date(todayIso)
  const day = d.getDay() // 0 = воскресенье, 1 = понедельник, 2 = вторник, ..., 6 = суббота
  return day === 1 || day === 2 // Понедельник (1) или вторник (2)
}
