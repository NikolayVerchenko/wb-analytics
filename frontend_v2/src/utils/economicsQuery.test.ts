import { describe, expect, it } from 'vitest'
import {
  buildEconomicsQuery,
  buildPrefixedEconomicsQuery,
  getDefaultEconomicsDates,
  normalizeQueryArray,
  parseEconomicsQuery,
  parsePrefixedEconomicsQuery,
} from './economicsQuery'

describe('economicsQuery utils', () => {
  it('builds legacy table query with only non-empty filters', () => {
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
      table_date_from: '2026-03-01',
      table_date_to: '2026-03-22',
      table_subjects: ['Комплекты белья'],
      table_brands: undefined,
      table_articles: ['in-12'],
    })
  })

  it('parses prefixed arrays and scalar values from query', () => {
    expect(
      parsePrefixedEconomicsQuery({
        table_date_from: '2026-03-01',
        table_date_to: '2026-03-22',
        table_subjects: 'Комплекты белья',
        table_brands: ['INAI', 'MOONGLOW'],
        table_articles: ['in-12'],
      }, 'table'),
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

  it('falls back to provided table state for dashboard query', () => {
    expect(
      parsePrefixedEconomicsQuery(
        {},
        'dashboard',
        new Date('2026-03-23T00:00:00Z'),
        {
          date_from: '2026-03-01',
          date_to: '2026-03-22',
          filters: {
            subjects: ['Комплекты белья'],
            brands: ['INAI'],
            articles: ['in-12'],
          },
        },
      ),
    ).toEqual({
      date_from: '2026-03-01',
      date_to: '2026-03-22',
      filters: {
        subjects: ['Комплекты белья'],
        brands: ['INAI'],
        articles: ['in-12'],
      },
    })
  })

  it('keeps explicit dashboard empty filters instead of falling back to table filters', () => {
    expect(
      parsePrefixedEconomicsQuery(
        {
          dashboard_date_from: '2026-03-01',
          dashboard_date_to: '2026-03-22',
        },
        'dashboard',
        new Date('2026-03-23T00:00:00Z'),
        {
          date_from: '2026-03-01',
          date_to: '2026-03-22',
          filters: {
            subjects: ['Комплекты белья'],
            brands: ['INAI'],
            articles: ['in-12'],
          },
        },
      ),
    ).toEqual({
      date_from: '2026-03-01',
      date_to: '2026-03-22',
      filters: {
        subjects: ['Комплекты белья'],
        brands: ['INAI'],
        articles: ['in-12'],
      },
    })
  })

  it('builds prefixed query without empty filters', () => {
    expect(
      buildPrefixedEconomicsQuery({
        prefix: 'dashboard',
        date_from: '2026-03-01',
        date_to: '2026-03-22',
        filters: {
          subjects: [],
          brands: ['INAI'],
          articles: [],
        },
      }),
    ).toEqual({
      dashboard_date_from: '2026-03-01',
      dashboard_date_to: '2026-03-22',
      dashboard_subjects: undefined,
      dashboard_brands: ['INAI'],
      dashboard_articles: undefined,
    })
  })

  it('keeps legacy parseEconomicsQuery mapped to table-prefixed query', () => {
    expect(
      parseEconomicsQuery({
        table_date_from: '2026-03-01',
        table_date_to: '2026-03-22',
        table_subjects: ['Комплекты белья'],
      }),
    ).toEqual({
      date_from: '2026-03-01',
      date_to: '2026-03-22',
      filters: {
        subjects: ['Комплекты белья'],
        brands: [],
        articles: [],
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
