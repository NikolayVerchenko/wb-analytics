import { computed, ref } from 'vue'

const STORAGE_KEY = 'wb_selected_account_id'

function readStoredAccountId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(STORAGE_KEY)
}

const selectedAccountId = ref<string | null>(readStoredAccountId())

export const selectedAccount = computed(() => selectedAccountId.value)

export function getSelectedAccountId(): string | null {
  return selectedAccountId.value
}

export function setSelectedAccountId(accountId: string | null) {
  selectedAccountId.value = accountId

  if (typeof window === 'undefined') {
    return
  }

  if (accountId) {
    window.localStorage.setItem(STORAGE_KEY, accountId)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function ensureSelectedAccountId(validAccountIds: string[]) {
  if (selectedAccountId.value && validAccountIds.includes(selectedAccountId.value)) {
    return selectedAccountId.value
  }

  if (validAccountIds.length === 0) {
    setSelectedAccountId(null)
    return null
  }

  setSelectedAccountId(validAccountIds[0])
  return selectedAccountId.value
}
