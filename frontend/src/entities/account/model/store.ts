import { defineStore } from 'pinia'

import { fetchAccounts } from '../api/accountsApi'
import type { Account } from './types'

const STORAGE_KEY = 'wb-analytics:selected-account-id'

interface AccountsState {
  items: Account[]
  selectedAccountId: string | null
  isLoading: boolean
  isInitialized: boolean
  errorMessage: string | null
}

export const useAccountsStore = defineStore('accounts', {
  state: (): AccountsState => ({
    items: [],
    selectedAccountId: null,
    isLoading: false,
    isInitialized: false,
    errorMessage: null,
  }),
  getters: {
    selectedAccount(state): Account | null {
      return state.items.find((item) => item.account_id === state.selectedAccountId) ?? null
    },
  },
  actions: {
    restoreSelection() {
      if (typeof window === 'undefined') {
        return
      }
      const savedAccountId = window.localStorage.getItem(STORAGE_KEY)
      if (savedAccountId) {
        this.selectedAccountId = savedAccountId
      }
    },
    persistSelection() {
      if (typeof window === 'undefined' || !this.selectedAccountId) {
        return
      }
      window.localStorage.setItem(STORAGE_KEY, this.selectedAccountId)
    },
    async initialize() {
      if (this.isInitialized) {
        return
      }
      this.restoreSelection()
      await this.loadAccounts()
      this.isInitialized = true
    },
    async loadAccounts() {
      this.isLoading = true
      this.errorMessage = null
      try {
        const accounts = await fetchAccounts()
        this.items = accounts
        const selectedStillExists = accounts.some((item) => item.account_id === this.selectedAccountId)
        if (!selectedStillExists) {
          this.selectedAccountId = accounts[0]?.account_id ?? null
        }
        this.persistSelection()
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      } finally {
        this.isLoading = false
      }
    },
    selectAccount(accountId: string) {
      this.selectedAccountId = accountId
      this.persistSelection()
    },
  },
})
