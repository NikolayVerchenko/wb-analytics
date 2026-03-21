import type { FilterSection } from '../../../shared/ui/filters/types'

export const economicsFilterSections: FilterSection[] = [
  {
    key: 'subject',
    label: 'Предмет',
    icon: '◫',
    options: [
      { value: 'corsets', label: 'Корсеты' },
      { value: 'lingerie-sets', label: 'Комплекты белья' },
      { value: 'bodysuits', label: 'Боди' },
      { value: 'bras', label: 'Бюстгальтеры' },
      { value: 'briefs', label: 'Трусы' },
    ],
  },
  {
    key: 'brand',
    label: 'Бренд',
    icon: '◇',
    options: [
      { value: 'wb-style', label: 'WB Style' },
      { value: 'rm-style', label: 'RM Style' },
      { value: 'private-line', label: 'Private Line' },
    ],
  },
  {
    key: 'article',
    label: 'Артикул',
    icon: '#',
    options: [
      { value: 'in-12', label: 'in-12' },
      { value: 'in-16', label: 'in-16' },
      { value: 'in-18', label: 'in-18' },
      { value: 'in-19', label: 'in-19' },
      { value: 'in-20', label: 'in-20' },
      { value: 'in-21', label: 'in-21' },
      { value: 'in-22', label: 'in-22' },
      { value: 'in-23', label: 'in-23' },
    ],
  },
]
