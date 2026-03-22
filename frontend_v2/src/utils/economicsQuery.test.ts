import { describe, expect, it } from 'vitest'
import { buildEconomicsQuery, getDefaultEconomicsDates, normalizeQueryArray, parseEconomicsQuery } from './economicsQuery'

describe('economicsQuery utils', () => {
  it('builds query with only non-empty filters', () => {
    expect(
      buildEconomicsQuery({
        account_id: 'acc-1',
        date_from: '2026-03-01',
        date_to: '2026-03-22',
        filters: {
          subjects: ['Комплекты белья'],
          brands: [],
          articles: ['in-12'],
        },
      }),
    ).toEqual({
      account_id: 'acc-1',
      date_from: '2026-03-01',
      date_to: '2026-03-22',
      subjects: ['Комплекты белья'],
      brands: undefined,
      articles: ['in-12'],
    })
  })

  it('parses arrays and scalar values from query', () => {
    expect(
      parseEconomicsQuery({
        date_from: '2026-03-01',
        date_to: '2026-03-22',
        subjects: 'Комплекты белья',
        brands: ['INAI', 'MOONGLOW'],
        articles: ['in-12'],
      }),
    ).toEqual({
      date_from: '2026-03-01',
      date_to: '2026-03-22',
      filters: {
        subjects: ['Комплекты белья'],
        brands: ['INAI', 'MOONGLOW'],
        articles: ['in-12'],
      },
    })
  })

  it('uses defaults when dates are absent', () => {
    expect(getDefaultEconomicsDates(new Date('2026-03-23T00:00:00Z'))).toEqual({
      date_from: '2026-02-21',
      date_to: '2026-03-23',
    })
  })

  it('normalizes query arrays safely', () => {
    expect(normalizeQueryArray(['a', '', 1, 'b'])).toEqual(['a', 'b'])
    expect(normalizeQueryArray('x')).toEqual(['x'])
    expect(normalizeQueryArray(undefined)).toEqual([])
  })
})
