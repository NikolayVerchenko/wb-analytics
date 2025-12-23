/**
 * Сервис для работы с диапазонами дат
 */
export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  label?: string // Опциональная метка (например, "Last 30 days")
}

export interface WeekOption {
  label: string // Например, "Неделя 45 (11.11 - 17.11)"
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  weekNumber: number
  year: number
}

export class DateRangeService {
  // Минимальная дата - начало данных API
  private readonly MIN_DATE = '2024-01-29'

  /**
   * Получает сегодняшнюю дату в формате YYYY-MM-DD
   */
  getToday(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Получает минимальную доступную дату
   */
  getMinDate(): string {
    return this.MIN_DATE
  }

  /**
   * Валидирует диапазон дат
   */
  validateRange(start: string, end: string): { valid: boolean; error?: string } {
    if (!start || !end) {
      return { valid: false, error: 'Даты не могут быть пустыми' }
    }

    if (start < this.MIN_DATE) {
      return { valid: false, error: `Дата не может быть раньше ${this.formatDate(this.MIN_DATE)}` }
    }

    if (end < this.MIN_DATE) {
      return { valid: false, error: `Дата не может быть раньше ${this.formatDate(this.MIN_DATE)}` }
    }

    if (start > end) {
      return { valid: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    // Проверяем, что даты не в будущем (сравниваем только даты без времени)
    const today = this.getToday()
    const todayDate = new Date(today)
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    // Нормализуем к началу дня для корректного сравнения
    const todayNormalized = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate())
    const startNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const endNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    
    if (startNormalized > todayNormalized || endNormalized > todayNormalized) {
      return { valid: false, error: 'Даты не могут быть в будущем' }
    }

    return { valid: true }
  }

  /**
   * Последние N дней
   */
  getLastNDays(days: number): DateRange {
    const end = this.getToday()
    const startDate = new Date(end)
    startDate.setDate(startDate.getDate() - days + 1) // +1 чтобы включить сегодня
    const start = startDate.toISOString().split('T')[0]

    return {
      start: start < this.MIN_DATE ? this.MIN_DATE : start,
      end,
      label: `Последние ${days} дней`,
    }
  }

  /**
   * Последние 30 дней
   */
  getLast30Days(): DateRange {
    return this.getLastNDays(30)
  }

  /**
   * Последние 90 дней
   */
  getLast90Days(): DateRange {
    return this.getLastNDays(90)
  }

  /**
   * Текущий год (с 1 января по сегодня)
   */
  getCurrentYear(): DateRange {
    const today = this.getToday()
    const year = new Date(today).getFullYear()
    const start = `${year}-01-01`
    
    return {
      start: start < this.MIN_DATE ? this.MIN_DATE : start,
      end: today,
      label: `${year} год`,
    }
  }

  /**
   * Произвольный диапазон
   */
  getCustomRange(start: string, end: string): DateRange {
    return {
      start,
      end,
      label: 'Произвольный период',
    }
  }

  /**
   * Получает номер недели года для даты
   */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  /**
   * Получает начало недели для даты (понедельник) в UTC
   */
  getWeekStart(date: Date): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const day = d.getUTCDay()
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1) // Понедельник
    return new Date(d.setUTCDate(diff))
  }

  /**
   * Получает конец недели для даты (воскресенье) в UTC
   */
  getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    return weekEnd
  }

  /**
   * Генерирует список недель для года
   */
  getWeeksForYear(year: number): WeekOption[] {
    const weeks: WeekOption[] = []
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    const today = new Date()
    const minDate = new Date(this.MIN_DATE + 'T00:00:00Z')

    let currentDate = new Date(this.getWeekStart(yearStart))

    while (currentDate <= yearEnd) {
      const weekStart = new Date(currentDate)
      const weekEnd = this.getWeekEnd(weekStart)

      // Пропускаем недели, которые полностью до минимальной даты
      if (weekEnd < minDate) {
        currentDate.setDate(currentDate.getDate() + 7)
        continue
      }

      // Ограничиваем неделю максимальной датой (сегодня или конец года)
      const actualStart = weekStart < minDate ? minDate : weekStart
      const actualEnd = weekEnd > today ? today : (weekEnd > new Date(yearEnd) ? new Date(yearEnd) : weekEnd)

      if (actualStart <= actualEnd) {
        const weekNumber = this.getWeekNumber(weekStart)
        
        weeks.push({
          label: `Неделя ${weekNumber} (${this.formatDateShort(actualStart)} - ${this.formatDateShort(actualEnd)})`,
          start: actualStart.toISOString().split('T')[0],
          end: actualEnd.toISOString().split('T')[0],
          weekNumber,
          year,
        })
      }

      currentDate.setDate(currentDate.getDate() + 7)
    }

    return weeks
  }

  /**
   * Получает список недель для текущего и прошлого года
   */
  getAvailableWeeks(): WeekOption[] {
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1
    
    const currentYearWeeks = this.getWeeksForYear(currentYear)
    const lastYearWeeks = this.getWeeksForYear(lastYear)
    
    // Объединяем и сортируем по дате (новые сверху)
    return [...currentYearWeeks, ...lastYearWeeks].sort((a, b) => {
      return b.start.localeCompare(a.start)
    })
  }

  /**
   * Получает диапазон для конкретной недели
   */
  getWeekRange(weekNumber: number, year: number): DateRange | null {
    const weeks = this.getWeeksForYear(year)
    const week = weeks.find(w => w.weekNumber === weekNumber && w.year === year)
    
    if (!week) return null

    return {
      start: week.start,
      end: week.end,
      label: week.label,
    }
  }

  /**
   * Форматирует дату для отображения (DD.MM.YYYY)
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00Z')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}.${month}.${year}`
  }

  /**
   * Форматирует дату коротко (DD.MM)
   */
  formatDateShort(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : date
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${day}.${month}`
  }

  /**
   * Форматирует диапазон для отображения
   */
  formatRange(range: DateRange): string {
    if (range.label) {
      return range.label
    }
    return `${this.formatDate(range.start)} - ${this.formatDate(range.end)}`
  }

  /**
   * Проверяет, является ли диапазон предустановленным
   */
  isPreset(range: DateRange): boolean {
    if (!range.label) return false
    
    const last30 = this.getLast30Days()
    const last90 = this.getLast90Days()
    const currentYear = this.getCurrentYear()

    return (
      range.label === last30.label ||
      range.label === last90.label ||
      range.label === currentYear.label
    )
  }
}

