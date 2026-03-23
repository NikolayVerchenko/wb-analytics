<template>
  <section class="card stack">
    <div>
      <h2 class="page-title">Кабинеты</h2>
      <p class="page-description">
        Страница загружает список кабинетов с `/api/accounts`. Клик по кабинету открывает
        страницу юнит-экономики.
      </p>
    </div>

    <div v-if="loading" class="message message-info">Загрузка кабинетов...</div>
    <div v-else-if="error" class="message message-error">{{ error }}</div>
    <div v-else-if="accounts.length === 0" class="message message-empty">Кабинеты не найдены.</div>

    <div v-else class="accounts-list">
      <button
        v-for="account in accounts"
        :key="account.account_id"
        type="button"
        class="account-button"
        @click="openEconomics(account.account_id)"
      >
        <span class="account-name">{{ getAccountTitle(account) }}</span>
        <span class="account-id">{{ account.account_id }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAccounts } from '../api/accounts'
import type { Account } from '../types/account'

const router = useRouter()

const accounts = ref<Account[]>([])
const loading = ref(false)
const error = ref('')

function getAccountTitle(account: Account): string {
  return account.seller_name || account.name || 'Без названия'
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function getDefaultPeriod() {
  const today = new Date()
  const dateTo = formatDate(today)

  const dateFromValue = new Date(today)
  dateFromValue.setDate(today.getDate() - 30)

  return {
    table_date_from: formatDate(dateFromValue),
    table_date_to: dateTo,
  }
}

function openEconomics(accountId: string) {
  router.push({
    path: '/economics',
    query: {
      account_id: accountId,
      ...getDefaultPeriod(),
    },
  })
}

async function loadAccounts() {
  loading.value = true
  error.value = ''

  try {
    accounts.value = await getAccounts()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить кабинеты.'
  } finally {
    loading.value = false
  }
}

onMounted(loadAccounts)
</script>
