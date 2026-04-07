export type FilterSection = 'subject' | 'brand' | 'article'

export type FilterOption = {
  value: string
  label: string
  hint?: string | null
}

export type EconomicsFilterOptions = {
  subjects: FilterOption[]
  brands: FilterOption[]
  articles: FilterOption[]
}

export type EconomicsFiltersValue = {
  subjects: string[]
  brands: string[]
  articles: string[]
}

export type GetEconomicsFilterOptionsParams = {
  account_id: string
  date_from: string
  date_to: string
}
