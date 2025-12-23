export interface WeekPeriod {
  start: string // RFC3339 format
  end: string // RFC3339 format
  weekId: string // Format: "2024-W45"
}

export class DatePeriodService {
  private readonly MIN_DATE = new Date('2024-01-29T00:00:00Z')

  /**
   * Генерирует массив недельных интервалов от текущей даты назад до 29.01.2024
   * @returns Массив недельных периодов в формате RFC3339
   */
  generateWeeklyPeriods(): WeekPeriod[] {
    const now = new Date()
    return this.generateWeeklyPeriodsBetween(this.MIN_DATE, now)
  }

  /**
   * Генерирует массив недельных интервалов между двумя датами
   * Генерирует только те недели, которые пересекаются с указанным диапазоном
   * @param dateFrom Начальная дата
   * @param dateTo Конечная дата
   * @returns Массив недельных периодов в формате RFC3339
   */
  generateWeeklyPeriodsBetween(dateFrom: Date, dateTo: Date): WeekPeriod[] {
    const periods: WeekPeriod[] = []
    
    // Нормализуем даты
    const from = new Date(dateFrom)
    from.setUTCHours(0, 0, 0, 0)
    
    const to = new Date(dateTo)
    to.setUTCHours(23, 59, 59, 999)

    // Находим начало первой недели, которая пересекается с диапазоном
    // Неделя начинается с понедельника
    let weekStart = new Date(from)
    const dayOfWeek = weekStart.getUTCDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Понедельник = 1
    weekStart.setUTCDate(weekStart.getUTCDate() + diff)
    weekStart.setUTCHours(0, 0, 0, 0)

    // Если начало недели раньше dateFrom, это нормально - мы обрежем неделю по from
    // Не нужно переходить к следующей неделе, так как текущая неделя все равно пересекается с диапазоном

    // Генерируем недели, пока начало недели не выйдет за пределы диапазона
    while (weekStart <= to) {
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      weekEnd.setUTCHours(23, 59, 59, 999)

      // Проверяем, что неделя пересекается с диапазоном
      // Неделя пересекается, если её конец >= from И начало <= to
      if (weekEnd >= from && weekStart <= to) {
        // Обрезаем неделю по границам диапазона
        const actualStart = weekStart < from ? new Date(from) : new Date(weekStart)
        // Для weekly отчетов API: dateFrom = понедельник, dateTo = воскресенье
        // API включает dateTo полностью, поэтому передаем воскресенье как dateTo
        // Если неделя обрезана, используем обрезанную дату, иначе - воскресенье
        let actualEnd: Date
        if (weekEnd > to) {
          actualEnd = new Date(to)
        } else {
          // Неделя не обрезана - используем воскресенье
          // weekEnd уже содержит воскресенье с временем 23:59:59.999
          // Но для API передаем просто дату воскресенья
          actualEnd = new Date(weekEnd)
        }

        const weekId = this.getWeekId(weekStart) // Используем начало недели для weekId, а не обрезанную дату
        periods.push({
          start: this.toRFC3339(actualStart, false), // Начало недели: только дата (понедельник)
          end: this.toRFC3339(actualEnd, true), // Конец недели: дата с временем 23:59:59 (воскресенье)
          weekId,
        })
      }

      // Переходим к следующей неделе
      weekStart.setUTCDate(weekStart.getUTCDate() + 7)
      
      // Если начало следующей недели уже после to, прекращаем
      if (weekStart > to) {
        break
      }
    }

    return periods
  }

  /**
   * Преобразует Date в RFC3339 формат для API Wildberries
   * API принимает даты в часовом поясе Москва (UTC+3)
   * Для начала дня передаем только дату, для конца дня - дату с временем 23:59:59+03:00
   * @param date Дата для форматирования
   * @param includeTime Если true, включает время 23:59:59+03:00 для включения всего дня
   */
  toRFC3339(date: Date, includeTime: boolean = false): string {
    // Нормализуем дату к началу дня в UTC
    const normalizedDate = new Date(date)
    normalizedDate.setUTCHours(0, 0, 0, 0)
    
    const year = normalizedDate.getUTCFullYear()
    const month = String(normalizedDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(normalizedDate.getUTCDate()).padStart(2, '0')
    
    if (includeTime) {
      // Конец дня: дата с временем 23:59:59+03:00
      // API интерпретирует это как конец дня в московском времени
      return `${year}-${month}-${day}T23:59:59+03:00`
    } else {
      // Начало дня: только дата (API интерпретирует как начало дня в московском времени)
      return `${year}-${month}-${day}`
    }
  }

  /**
   * Генерирует идентификатор недели в формате "YYYY-WNN"
   * Использует ISO недели (неделя начинается с понедельника)
   */
  getWeekId(date: Date): string {
    const year = date.getUTCFullYear()
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    
    // Находим первый понедельник года
    const firstMonday = new Date(startOfYear)
    const dayOfWeek = startOfYear.getUTCDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    firstMonday.setUTCDate(firstMonday.getUTCDate() + daysToMonday)
    
    // Если 1 января - понедельник, то первая неделя начинается с него
    if (dayOfWeek === 1) {
      firstMonday.setTime(startOfYear.getTime())
    }
    
    // Если дата раньше первого понедельника, берем предыдущий год
    if (date < firstMonday) {
      const prevYear = year - 1
      const prevYearStart = new Date(Date.UTC(prevYear, 11, 31))
      return this.getWeekId(prevYearStart)
    }
    
    const days = Math.floor((date.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.floor(days / 7) + 1
    
    return `${year}-W${String(weekNumber).padStart(2, '0')}`
  }

  /**
   * Генерирует идентификатор дня в формате "YYYY-MM-DD"
   */
  getDayId(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Получить идентификатор текущей недели
   */
  getCurrentWeekId(): string {
    return this.getWeekId(new Date())
  }

  /**
   * Получить идентификатор прошлой недели
   */
  getLastWeekId(): string {
    const lastWeek = new Date()
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7)
    return this.getWeekId(lastWeek)
  }

  /**
   * Получить идентификатор текущего дня
   */
  getCurrentDayId(): string {
    return this.getDayId(new Date())
  }

  /**
   * Получить дату начала недели по weekId (формат "YYYY-WNN")
   */
  getWeekStartDate(weekId: string): Date | null {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/)
    if (!match) {
      return null
    }

    const year = parseInt(match[1], 10)
    const weekNumber = parseInt(match[2], 10)

    // Находим первый понедельник года
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const dayOfWeek = startOfYear.getUTCDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const firstMonday = new Date(startOfYear)
    firstMonday.setUTCDate(firstMonday.getUTCDate() + daysToMonday)

    // Если 1 января - понедельник, то первая неделя начинается с него
    if (dayOfWeek === 1) {
      firstMonday.setTime(startOfYear.getTime())
    }

    // Вычисляем начало нужной недели
    const weekStart = new Date(firstMonday)
    weekStart.setUTCDate(weekStart.getUTCDate() + (weekNumber - 1) * 7)
    weekStart.setUTCHours(0, 0, 0, 0)

    return weekStart
  }
}
