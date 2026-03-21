import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccountsStore } from '../../account/model/store'
import { fetchSupplies, fetchSupplyItems, saveSupplyArticleCostForAllSizes, saveSupplyItemCost } from '../api/suppliesApi'
import type { Supply, SupplyItem, SupplyItemCostState } from './types'
import { getQueryNumber, replaceQuery } from '../../../shared/lib/queryState'

const EXPANDED_SUPPLY_QUERY_KEY = 'supply_id'

export function useSupplies() {
  const accountsStore = useAccountsStore()
  const route = useRoute()
  const router = useRouter()
  const items = ref<Supply[]>([])
  const supplyItems = ref<Record<number, SupplyItem[]>>({})
  const itemErrors = ref<Record<number, string | null>>({})
  const expandedIds = ref<number[]>([])
  const loadingItemIds = ref<number[]>([])
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const costDrafts = ref<Record<string, string>>({})
  const savingCostKeys = ref<string[]>([])
  const savingArticleCostKeys = ref<string[]>([])
  const costErrors = ref<Record<string, string | null>>({})
  const costSuccess = ref<Record<string, boolean>>({})
  let currentSuppliesAbortController: AbortController | null = null
  const getCostState = getCostStateFactory(
    costDrafts,
    savingCostKeys,
    savingArticleCostKeys,
    costErrors,
    costSuccess,
  )

  const selectedAccountName = computed(
    () => accountsStore.selectedAccount?.seller_name || accountsStore.selectedAccount?.name || null,
  )

  onMounted(async () => {
    await accountsStore.initialize()
    await loadSupplies()
    await syncExpandedSupplyFromRoute()
  })

  watch(
    () => accountsStore.selectedAccountId,
    async (nextAccountId, previousAccountId) => {
      if (nextAccountId && nextAccountId !== previousAccountId) {
        await loadSupplies()
        await syncExpandedSupplyFromRoute()
      }
    },
  )

  watch(
    () => route.query[EXPANDED_SUPPLY_QUERY_KEY],
    async () => {
      await syncExpandedSupplyFromRoute()
    },
  )

  async function loadSupplies() {
    if (!accountsStore.selectedAccountId) {
      items.value = []
      resetItemsState()
      return
    }

    currentSuppliesAbortController?.abort()
    currentSuppliesAbortController = new AbortController()

    isLoading.value = true
    errorMessage.value = null

    try {
      items.value = await fetchSupplies(accountsStore.selectedAccountId, {
        signal: currentSuppliesAbortController.signal,
      })
      resetItemsState()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  async function toggleItems(item: Supply) {
    const id = item.supply_id
    if (expandedIds.value.includes(id)) {
      expandedIds.value = expandedIds.value.filter((currentId) => currentId !== id)
      const nextQuery = { ...route.query }
      delete nextQuery[EXPANDED_SUPPLY_QUERY_KEY]
      await replaceQuery(router, nextQuery)
      return
    }

    expandedIds.value = [id]
    await replaceQuery(router, { ...route.query, [EXPANDED_SUPPLY_QUERY_KEY]: String(id) })

    if (supplyItems.value[id] || !accountsStore.selectedAccountId) {
      return
    }

    loadingItemIds.value = [...loadingItemIds.value, id]
    itemErrors.value = { ...itemErrors.value, [id]: null }

    try {
      const rows = await fetchSupplyItems(accountsStore.selectedAccountId, id)
      supplyItems.value = { ...supplyItems.value, [id]: rows }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      itemErrors.value = {
        ...itemErrors.value,
        [id]: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      loadingItemIds.value = loadingItemIds.value.filter((currentId) => currentId !== id)
    }
  }

  function updateCostDraft(supplyId: number, item: SupplyItem, value: string) {
    const key = itemRowKey(supplyId, item)
    costDrafts.value = { ...costDrafts.value, [key]: value }
    costErrors.value = { ...costErrors.value, [key]: null }
    costSuccess.value = { ...costSuccess.value, [key]: false }
  }

  async function saveCost(supplyId: number, item: SupplyItem) {
    if (!accountsStore.selectedAccountId) {
      return
    }

    const key = itemRowKey(supplyId, item)
    const rawValue = costDrafts.value[key] ?? (item.unit_cogs ? String(Number(item.unit_cogs)) : '')
    const unitCogs = Number(rawValue)

    if (!Number.isFinite(unitCogs) || unitCogs <= 0) {
      costErrors.value = { ...costErrors.value, [key]: 'Введите себестоимость больше 0' }
      costSuccess.value = { ...costSuccess.value, [key]: false }
      return
    }

    savingCostKeys.value = [...savingCostKeys.value, key]
    costErrors.value = { ...costErrors.value, [key]: null }
    costSuccess.value = { ...costSuccess.value, [key]: false }

    try {
      await saveSupplyItemCost(accountsStore.selectedAccountId, supplyId, {
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
        tech_size: item.tech_size,
        barcode: item.barcode,
        unit_cogs: unitCogs,
      })

      const rows = await fetchSupplyItems(accountsStore.selectedAccountId, supplyId)
      supplyItems.value = { ...supplyItems.value, [supplyId]: rows }
      costDrafts.value = { ...costDrafts.value, [key]: String(unitCogs) }
      costSuccess.value = { ...costSuccess.value, [key]: true }
    } catch (error) {
      costErrors.value = {
        ...costErrors.value,
        [key]: error instanceof Error ? error.message : 'Не удалось сохранить себестоимость',
      }
      costSuccess.value = { ...costSuccess.value, [key]: false }
    } finally {
      savingCostKeys.value = savingCostKeys.value.filter((currentKey) => currentKey !== key)
    }
  }

  async function saveArticleCost(supplyId: number, item: SupplyItem) {
    if (!accountsStore.selectedAccountId) {
      return
    }

    const key = itemRowKey(supplyId, item)
    const rawValue = costDrafts.value[key] ?? (item.unit_cogs ? String(Number(item.unit_cogs)) : '')
    const unitCogs = Number(rawValue)

    if (!Number.isFinite(unitCogs) || unitCogs <= 0) {
      costErrors.value = { ...costErrors.value, [key]: 'Введите себестоимость больше 0' }
      costSuccess.value = { ...costSuccess.value, [key]: false }
      return
    }

    savingArticleCostKeys.value = [...savingArticleCostKeys.value, key]
    costErrors.value = { ...costErrors.value, [key]: null }
    costSuccess.value = { ...costSuccess.value, [key]: false }

    try {
      await saveSupplyArticleCostForAllSizes(accountsStore.selectedAccountId, supplyId, {
        nm_id: item.nm_id,
        vendor_code: item.vendor_code,
        unit_cogs: unitCogs,
      })

      const rows = await fetchSupplyItems(accountsStore.selectedAccountId, supplyId)
      supplyItems.value = { ...supplyItems.value, [supplyId]: rows }
      costSuccess.value = { ...costSuccess.value, [key]: true }
    } catch (error) {
      costErrors.value = {
        ...costErrors.value,
        [key]: error instanceof Error ? error.message : 'Не удалось применить цену ко всем размерам',
      }
      costSuccess.value = { ...costSuccess.value, [key]: false }
    } finally {
      savingArticleCostKeys.value = savingArticleCostKeys.value.filter((currentKey) => currentKey !== key)
    }
  }

  async function syncExpandedSupplyFromRoute() {
    const supplyId = getQueryNumber(route.query[EXPANDED_SUPPLY_QUERY_KEY])
    if (!supplyId || !items.value.some((item) => item.supply_id === supplyId)) {
      expandedIds.value = []
      return
    }

    if (!expandedIds.value.includes(supplyId)) {
      expandedIds.value = [supplyId]
    }

    if (supplyItems.value[supplyId] || !accountsStore.selectedAccountId) {
      return
    }

    loadingItemIds.value = [...loadingItemIds.value, supplyId]
    itemErrors.value = { ...itemErrors.value, [supplyId]: null }

    try {
      const rows = await fetchSupplyItems(accountsStore.selectedAccountId, supplyId)
      supplyItems.value = { ...supplyItems.value, [supplyId]: rows }
    } catch (error) {
      itemErrors.value = {
        ...itemErrors.value,
        [supplyId]: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      loadingItemIds.value = loadingItemIds.value.filter((currentId) => currentId !== supplyId)
    }
  }

  function resetItemsState() {
    supplyItems.value = {}
    itemErrors.value = {}
    expandedIds.value = []
    loadingItemIds.value = []
    costDrafts.value = {}
    costErrors.value = {}
    costSuccess.value = {}
    savingCostKeys.value = []
    savingArticleCostKeys.value = []
  }

  return {
    items,
    supplyItems,
    itemErrors,
    expandedIds,
    loadingItemIds,
    isLoading,
    errorMessage,
    costDrafts,
    savingCostKeys,
    savingArticleCostKeys,
    costErrors,
    costSuccess,
    selectedAccountName,
    getItemRowKey: itemRowKey,
    getCostState,
    toggleItems,
    updateCostDraft,
    saveCost,
    saveArticleCost,
  }
}

export function itemRowKey(supplyId: number, item: SupplyItem): string {
  return `${supplyId}|${item.nm_id}|${item.vendor_code}|${item.tech_size ?? ''}|${item.barcode ?? ''}`
}

function formatCostInput(value: string | null): string {
  if (!value) return ''
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? String(numberValue) : ''
}

function getCostStateFactory(
  costDrafts: Ref<Record<string, string>>,
  savingCostKeys: Ref<string[]>,
  savingArticleCostKeys: Ref<string[]>,
  costErrors: Ref<Record<string, string | null>>,
  costSuccess: Ref<Record<string, boolean>>,
) {
  return (supplyId: number, item: SupplyItem): SupplyItemCostState => {
    const key = itemRowKey(supplyId, item)
    return {
      draftValue: costDrafts.value[key] ?? formatCostInput(item.unit_cogs),
      isSaving: savingCostKeys.value.includes(key),
      isArticleSaving: savingArticleCostKeys.value.includes(key),
      isSuccess: Boolean(costSuccess.value[key]),
      errorMessage: costErrors.value[key] ?? null,
    }
  }
}
