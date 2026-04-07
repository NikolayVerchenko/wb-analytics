export type FilterOption = {
  value: string
  label: string
  count?: number
}

export type FilterSection = {
  key: string
  label: string
  icon?: string
  options: FilterOption[]
}

export type FilterSelection = Record<string, string[]>
