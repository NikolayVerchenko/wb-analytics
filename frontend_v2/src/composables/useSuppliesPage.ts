import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSupplies, getSupplyItems, putSupplyArticleCostForAllSizes, putSupplyItemCost } from '../api/supplies'
import type { Supply, SupplyItem } from '../types/supplies'
import { formatNumber } from '../utils/format'

export type SupplyStatusKey = 'accepted' | 'partial' | 'planned'

export type SupplyStatusMeta = {
  key: SupplyStatusKey
  label: string
}

export type SupplySummaryMetric = {
  key: string
  label: string
  value: string
  hint?: string
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU')
}

function getSupplyMoment(supply: Supply): string | null {
  return supply.fact_date ?? supply.supply_date ?? supply.updated_date ?? supply.create_date ?? null
}

function getSupplyStatusMeta(supply: Supply): SupplyStatusMeta {
  const planned = supply.planned_quantity ?? 0
  const accepted = supply.accepted_quantity_total ?? 0

  if ((planned > 0 && accepted >= planned) || supply.fact_date) {
    return { key: 'accepted', label: 'Принято' }
  }
  if (accepted > 0) {
    return { key: 'partial', label: 'Частично принято' }
  }
  return { key: 'planned', label: 'Запланировано' }
}

export function useSuppliesPage() {
  const route = useRoute()

  const accountId = computed(() => (typeof route.query.account_id === 'string' ? route.query.account_id : ''))
  const supplies = ref<Supply[]>([])
  const loading = ref(false)
  const error = ref('')

  const searchQuery = ref('')
  const statusFilter = ref<'all' | SupplyStatusKey>('all')
  const expandedSupplyIds = ref<number[]>([])
  const itemsBySupply = ref<Record<number, SupplyItem[]>>({})
  const itemsLoadingBySupply = ref<Record<number, boolean>>({})
  const itemsErrorBySupply = ref<Record<number, string>>({})
  const itemCostDrafts = ref<Record<string, string>>({})
  const savingKeys = ref<string[]>([])
  const itemMessages = ref<Record<string, string>>({})

  const hasAccount = computed(() => Boolean(accountId.value))
  const empty = computed(() => hasAccount.value && !loading.value && !error.value && supplies.value.length === 0)

  const filteredSupplies = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return supplies.value.filter((supply) => {
      const status = getSupplyStatusMeta(supply).key
      if (statusFilter.value !== 'all' && status !== statusFilter.value) {
        return false
      }
      if (!query) {
        return true
      }
      const haystack = [
        String(supply.supply_id),
        supply.preorder_id == null ? '' : String(supply.preorder_id),
        formatDateTime(getSupplyMoment(supply)),
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  })

  const summaryMetrics = computed<SupplySummaryMetric[]>(() => {
    const totalSupplies = supplies.value.length
    const totalItems = supplies.value.reduce((sum, supply) => sum + supply.items_count, 0)
    const plannedQuantity = supplies.value.reduce((sum, supply) => sum + supply.planned_quantity, 0)
    const acceptedQuantity = supplies.value.reduce((sum, supply) => sum + supply.accepted_quantity_total, 0)
    const acceptedSupplies = supplies.value.filter((supply) => getSupplyStatusMeta(supply).key === 'accepted').length
    const moments = supplies.value
      .map((supply) => getSupplyMoment(supply))
      .filter((value): value is string => Boolean(value))
      .sort()
    const latestMoment = moments.length > 0 ? moments[moments.length - 1] : null

    return [
      {
        key: 'supplies',
        label: 'Поставок',
        value: formatNumber(totalSupplies),
        hint: acceptedSupplies > 0 ? `Принято полностью: ${formatNumber(acceptedSupplies)}` : undefined,
      },
      {
        key: 'items',
        label: 'Позиций',
        value: formatNumber(totalItems),
      },
      {
        key: 'planned',
        label: 'Запланировано',
        value: formatNumber(plannedQuantity),
      },
      {
        key: 'accepted',
        label: 'Принято',
        value: formatNumber(acceptedQuantity),
        hint: plannedQuantity > 0 ? `${Math.round((acceptedQuantity / plannedQuantity) * 100)}% от плана` : undefined,
      },
      {
        key: 'updated',
        label: 'Последнее движение',
        value: latestMoment ? formatDateTime(latestMoment) : '—',
      },
    ]
  })

  function getItemKey(item: SupplyItem): string {
    return `${item.supply_id}-${item.vendor_code}-${item.tech_size || ''}-${item.barcode || ''}-${item.nm_id}`
  }

  function getDraftValue(item: SupplyItem): string {
    const key = getItemKey(item)
    if (key in itemCostDrafts.value) {
      return itemCostDrafts.value[key]
    }
    return item.unit_cogs == null ? '' : String(item.unit_cogs)
  }

  function setDraftValue(item: SupplyItem, value: string) {
    itemCostDrafts.value[getItemKey(item)] = value
    itemMessages.value[getItemKey(item)] = ''
  }

  function isSaving(item: SupplyItem): boolean {
    return savingKeys.value.includes(getItemKey(item))
  }

  async function loadSupplies() {
    if (!accountId.value) {
      supplies.value = []
      return
    }

    loading.value = true
    error.value = ''
    expandedSupplyIds.value = []
    itemsBySupply.value = {}
    itemsLoadingBySupply.value = {}
    itemsErrorBySupply.value = {}
    itemCostDrafts.value = {}
    itemMessages.value = {}

    try {
      supplies.value = await getSupplies({ account_id: accountId.value })
    } catch (err) {
      supplies.value = []
      error.value = err instanceof Error ? err.message : 'Не удалось загрузить поставки.'
    } finally {
      loading.value = false
    }
  }

  async function loadSupplyItems(supplyId: number) {
    if (!accountId.value || itemsBySupply.value[supplyId]) {
      return
    }

    itemsLoadingBySupply.value[supplyId] = true
    itemsErrorBySupply.value[supplyId] = ''

    try {
      itemsBySupply.value[supplyId] = await getSupplyItems(supplyId, { account_id: accountId.value })
    } catch (err) {
      itemsErrorBySupply.value[supplyId] = err instanceof Error ? err.message : 'Не удалось загрузить товары поставки.'
    } finally {
      itemsLoadingBySupply.value[supplyId] = false
    }
  }

  async function toggleSupply(supplyId: number) {
    if (expandedSupplyIds.value.includes(supplyId)) {
      expandedSupplyIds.value = expandedSupplyIds.value.filter((id) => id !== supplyId)
      return
    }

    expandedSupplyIds.value = [...expandedSupplyIds.value, supplyId]
    await loadSupplyItems(supplyId)
  }

  async function saveItemCost(supplyId: number, item: SupplyItem) {
    const key = getItemKey(item)
    const rawValue = getDraftValue(item).trim()
    const unitCogs = Number(rawValue)
    if (!rawValue || Number.isNaN(unitCogs) || unitCogs <= 0) {
      itemMessages.value[key] = 'Введите корректную себестоимость.'
      return
    }

    savingKeys.value = [...savingKeys.value, key]
    itemMessages.value[key] = ''

    try {
      await putSupplyItemCost(supplyId, accountId.value, {
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
        tech_size: item.tech_size,
        barcode: item.barcode,
        unit_cogs: unitCogs,
      })
      item.unit_cogs = unitCogs
      itemMessages.value[key] = 'Сохранено.'
    } catch (err) {
      itemMessages.value[key] = err instanceof Error ? err.message : 'Не удалось сохранить себестоимость.'
    } finally {
      savingKeys.value = savingKeys.value.filter((value) => value !== key)
    }
  }

  async function saveArticleCostForAllSizes(supplyId: number, item: SupplyItem) {
    const key = getItemKey(item)
    const rawValue = getDraftValue(item).trim()
    const unitCogs = Number(rawValue)
    if (!rawValue || Number.isNaN(unitCogs) || unitCogs <= 0) {
      itemMessages.value[key] = 'Введите корректную себестоимость.'
      return
    }

    savingKeys.value = [...savingKeys.value, key]
    itemMessages.value[key] = ''

    try {
      await putSupplyArticleCostForAllSizes(supplyId, accountId.value, {
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
        unit_cogs: unitCogs,
      })
      for (const row of itemsBySupply.value[supplyId] ?? []) {
        if (row.nm_id === item.nm_id && row.vendor_code === item.vendor_code) {
          row.unit_cogs = unitCogs
          itemCostDrafts.value[getItemKey(row)] = String(unitCogs)
        }
      }
      itemMessages.value[key] = 'Сохранено для всех размеров.'
    } catch (err) {
      itemMessages.value[key] = err instanceof Error ? err.message : 'Не удалось сохранить себестоимость.'
    } finally {
      savingKeys.value = savingKeys.value.filter((value) => value !== key)
    }
  }

  watch(accountId, async () => {
    await loadSupplies()
  }, { immediate: true })

  return {
    accountId,
    hasAccount,
    supplies,
    filteredSupplies,
    loading,
    error,
    empty,
    searchQuery,
    statusFilter,
    summaryMetrics,
    expandedSupplyIds,
    itemsBySupply,
    itemsLoadingBySupply,
    itemsErrorBySupply,
    itemMessages,
    getItemKey,
    getDraftValue,
    setDraftValue,
    isSaving,
    toggleSupply,
    saveItemCost,
    saveArticleCostForAllSizes,
    formatDateTime,
    getSupplyStatusMeta,
  }
}
