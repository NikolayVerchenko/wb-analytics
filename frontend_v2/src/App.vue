<template>
  <div class="app-shell">
    <AppHeader :profile-name="profileName" />

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { getAccounts } from './api/accounts'
import AppHeader from './components/AppHeader.vue'
import type { Account } from './types/account'

const route = useRoute()
const accounts = ref<Account[]>([])

const profileName = computed(() => {
  const accountId = typeof route.query.account_id === 'string' ? route.query.account_id : ''

  if (!accountId) {
    return 'Выберите кабинет'
  }

  const currentAccount = accounts.value.find((account) => account.account_id === accountId)
  return currentAccount?.seller_name || currentAccount?.name || 'Без названия'
})

async function loadAccounts() {
  try {
    accounts.value = await getAccounts()
  } catch {
    accounts.value = []
  }
}

onMounted(loadAccounts)
</script>
