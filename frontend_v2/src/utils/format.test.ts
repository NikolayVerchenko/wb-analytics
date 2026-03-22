import { describe, expect, it } from 'vitest'
import { formatNumber, formatPercent } from './format'

describe('format utils', () => {
  it('formats numbers using ru-RU locale', () => {
    expect(formatNumber(12345.67)).toBe('12\u00A0345,67')
  })

  it('returns dash for empty numeric values', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber(undefined)).toBe('-')
  })

  it('formats percents using formatNumber', () => {
    expect(formatPercent(20.6)).toBe('20,6%')
  })

  it('returns dash for empty percents', () => {
    expect(formatPercent(null)).toBe('-')
  })
})
