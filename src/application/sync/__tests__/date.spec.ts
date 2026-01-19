import { describe, it, expect } from 'vitest'
import { lastClosedWeekRange, isWeeklyRebuildWindow, weekStartMonday } from '../date'

describe('date helpers', () => {
  describe('weekStartMonday', () => {
    it('should return Monday for Monday', () => {
      const monday = '2024-01-08' // Понедельник
      expect(weekStartMonday(monday)).toBe('2024-01-08')
    })

    it('should return Monday for Sunday', () => {
      const sunday = '2024-01-14' // Воскресенье
      expect(weekStartMonday(sunday)).toBe('2024-01-08') // Понедельник той же недели
    })

    it('should return Monday for Wednesday', () => {
      const wednesday = '2024-01-10' // Среда
      expect(weekStartMonday(wednesday)).toBe('2024-01-08') // Понедельник той же недели
    })
  })

  describe('lastClosedWeekRange', () => {
    it('should return previous week Mon-Sun for Wednesday', () => {
      const wednesday = '2024-01-10' // Среда 10 января
      const range = lastClosedWeekRange(wednesday)
      // Предыдущая неделя: 1-7 января (пн-вс)
      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-01-07')
    })

    it('should return previous week Mon-Sun for Thursday', () => {
      const thursday = '2024-01-11' // Четверг 11 января
      const range = lastClosedWeekRange(thursday)
      // Предыдущая неделя: 1-7 января (пн-вс)
      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-01-07')
    })

    it('should return previous week Mon-Sun for Monday', () => {
      const monday = '2024-01-08' // Понедельник 8 января
      const range = lastClosedWeekRange(monday)
      // Предыдущая неделя: 1-7 января (пн-вс)
      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-01-07')
    })

    it('should return previous week Mon-Sun for Tuesday', () => {
      const tuesday = '2024-01-09' // Вторник 9 января
      const range = lastClosedWeekRange(tuesday)
      // Предыдущая неделя: 1-7 января (пн-вс)
      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-01-07')
    })

    it('should return previous week Mon-Sun for Sunday', () => {
      const sunday = '2024-01-14' // Воскресенье 14 января
      const range = lastClosedWeekRange(sunday)
      // Предыдущая неделя: 8-14 января - это текущая неделя, предыдущая: 1-7 января
      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-01-07')
    })
  })

  describe('isWeeklyRebuildWindow', () => {
    it('should return true for Monday', () => {
      const monday = '2024-01-08' // Понедельник
      expect(isWeeklyRebuildWindow(monday)).toBe(true)
    })

    it('should return true for Tuesday', () => {
      const tuesday = '2024-01-09' // Вторник
      expect(isWeeklyRebuildWindow(tuesday)).toBe(true)
    })

    it('should return false for Wednesday', () => {
      const wednesday = '2024-01-10' // Среда
      expect(isWeeklyRebuildWindow(wednesday)).toBe(false)
    })

    it('should return false for Thursday', () => {
      const thursday = '2024-01-11' // Четверг
      expect(isWeeklyRebuildWindow(thursday)).toBe(false)
    })

    it('should return false for Friday', () => {
      const friday = '2024-01-12' // Пятница
      expect(isWeeklyRebuildWindow(friday)).toBe(false)
    })

    it('should return false for Saturday', () => {
      const saturday = '2024-01-13' // Суббота
      expect(isWeeklyRebuildWindow(saturday)).toBe(false)
    })

    it('should return false for Sunday', () => {
      const sunday = '2024-01-14' // Воскресенье
      expect(isWeeklyRebuildWindow(sunday)).toBe(false)
    })
  })
})
