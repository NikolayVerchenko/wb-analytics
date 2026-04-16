<template>
  <div class="app-shell">
    <AppHeader
      :accounts="accounts"
      :selected-account-id="selectedAccountId"
      :user-name="currentUserName"
      :user-email="currentUserEmail"
      :is-authenticated="isAuthenticated"
      @logout="handleLogout"
      @select-account="handleSelectAccount"
    />

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { getAccounts } from './api/accounts'
import { authState, isAuthenticated, logout, scopeAccount } from './auth/store'
import { ensureSelectedAccountId, selectedAccount, setSelectedAccountId } from './auth/selected-account'
import AppHeader from './components/AppHeader.vue'
import type { Account } from './types/account'

const route = useRoute()
const router = useRouter()
const accounts = ref<Account[]>([])

const selectedAccountId = computed(() => selectedAccount.value)
const currentUserName = computed(() => authState.user?.name || null)
const currentUserEmail = computed(() => authState.user?.email || null)

async function loadAccounts() {
  if (!isAuthenticated.value) {
    accounts.value = []
    setSelectedAccountId(null)
    return
  }

  try {
    accounts.value = await getAccounts()
    const resolvedAccountId = ensureSelectedAccountId(accounts.value.map((account) => account.account_id))
    if (resolvedAccountId) {
      await scopeAccount(resolvedAccountId)
    }
  } catch {
    accounts.value = []
    setSelectedAccountId(null)
  }
}

async function handleLogout() {
  await logout()
  accounts.value = []
  setSelectedAccountId(null)
  await router.push({ name: 'register' })
}

async function handleSelectAccount(accountId: string | null) {
  setSelectedAccountId(accountId)

  if (accountId && isAuthenticated.value) {
    await scopeAccount(accountId)
  }

  const pagesUsingAccountQuery = new Set(['economics', 'economics-problems', 'stocks', 'supplies', 'sync'])
  if (route.name && pagesUsingAccountQuery.has(String(route.name))) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        account_id: accountId || undefined,
      },
    })
  }
}

onMounted(loadAccounts)

watch(
  () => authState.user?.id,
  () => {
    void loadAccounts()
  },
)

watch(
  () => route.query.account_id,
  async (accountId) => {
    if (typeof accountId === 'string' && accountId) {
      const shouldScope = selectedAccount.value !== accountId
      setSelectedAccountId(accountId)
      if (shouldScope && isAuthenticated.value) {
        await scopeAccount(accountId)
      }
    }
  },
  { immediate: true },
)
</script>

