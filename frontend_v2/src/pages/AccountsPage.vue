<template>
  <section class="accounts-page stack">
    <div class="card accounts-hero">
      <div class="accounts-hero-copy">
        <h1 class="page-title accounts-title">Настройки</h1>
        <p class="page-description accounts-description">
          Управление кабинетом и налоговой ставкой для расчета полной аналитики.
        </p>
      </div>

      <button type="button" class="primary-button accounts-connect-button" @click="openConnectAccount">
        Подключить кабинет
      </button>
    </div>

    <UiStateBlock
      v-if="!selectedAccountId"
      title="Активный кабинет не выбран"
      description="Выберите кабинет ниже, чтобы редактировать налоговую ставку."
      variant="empty"
    />
    <TaxSettingsCard
      v-else
      v-model:tax-rate="taxRatePercent"
      v-model:effective-from="taxEffectiveFrom"
      :loading="taxLoading"
      :saving="taxSaving"
      :error="taxError"
      :message="taxMessage"
      @save-tax-settings="saveTaxSettings"
    />

    <div v-if="loading" class="message message-info">Загрузка кабинетов...</div>
    <div v-else-if="error" class="message message-error">{{ error }}</div>
    <div v-else-if="accounts.length === 0" class="card accounts-empty-state">
      <div class="accounts-empty-copy">
        <h2 class="section-title accounts-empty-title">Пока нет подключённых кабинетов</h2>
        <p class="accounts-empty-text">
          Подключите свой кабинет Wildberries, чтобы открыть аналитику, остатки и загрузку данных.
        </p>
      </div>

      <div class="accounts-empty-actions">
        <button type="button" class="primary-button" @click="openConnectAccount">
          Подключить кабинет
        </button>
      </div>
    </div>

    <div v-else class="accounts-grid">
      <article
        v-for="account in accounts"
        :key="account.account_id"
        class="account-tile"
        :class="{ 'account-tile-selected': selectedAccountId === account.account_id }"
      >
        <div class="account-tile-header">
          <div class="account-tile-main">
            <h2 class="account-tile-title">{{ getAccountTitle(account) }}</h2>
            <p class="account-tile-id">{{ account.account_id }}</p>
          </div>

          <span class="account-tile-status">
            {{ account.status || 'active' }}
          </span>
        </div>

        <div class="account-tile-meta">
          <span v-if="account.wb_seller_id" class="account-meta-chip">
            WB ID: {{ account.wb_seller_id }}
          </span>
          <span v-if="account.trade_mark" class="account-meta-chip">
            {{ account.trade_mark }}
          </span>
        </div>

        <div class="account-tile-footer">
          <p class="account-tile-hint">
            {{ selectedAccountId === account.account_id ? 'Этот кабинет уже выбран в меню.' : 'Сделайте кабинет активным для работы через верхнее меню.' }}
          </p>

          <button
            type="button"
            class="account-select-button"
            :class="{ 'account-select-button-active': selectedAccountId === account.account_id }"
            :disabled="selectingAccountId === account.account_id"
            @click="selectAccount(account.account_id)"
          >
            {{
              selectingAccountId === account.account_id
                ? 'Применяю...'
                : selectedAccountId === account.account_id
                  ? 'Выбран'
                  : 'Сделать активным'
            }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAccounts } from '../api/accounts'
import { scopeAccount } from '../auth/store'
import { selectedAccount, setSelectedAccountId } from '../auth/selected-account'
import TaxSettingsCard from '../components/TaxSettingsCard.vue'
import UiStateBlock from '../components/UiStateBlock.vue'
import { useTaxSettings } from '../composables/useTaxSettings'
import type { Account } from '../types/account'

const router = useRouter()

const accounts = ref<Account[]>([])
const loading = ref(false)
const error = ref('')
const selectedAccountId = computed(() => selectedAccount.value)
const selectingAccountId = ref('')

const {
  loading: taxLoading,
  saving: taxSaving,
  error: taxError,
  message: taxMessage,
  taxRatePercent,
  effectiveFrom: taxEffectiveFrom,
  save: saveTaxSettings,
} = useTaxSettings({
  accountId: () => selectedAccountId.value || '',
})

function getAccountTitle(account: Account): string {
  return account.seller_name || account.name || 'Без названия'
}

function openConnectAccount() {
  router.push({ name: 'connect-account' })
}

async function selectAccount(accountId: string) {
  selectingAccountId.value = accountId
  setSelectedAccountId(accountId)
  try {
    await scopeAccount(accountId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось сделать кабинет активным.'
  } finally {
    selectingAccountId.value = ''
  }
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

<style scoped>
.accounts-page {
  gap: 18px;
}

.accounts-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.accounts-hero-copy {
  max-width: 760px;
}

.accounts-title {
  margin-bottom: 8px;
}

.accounts-description {
  margin-bottom: 0;
}

.accounts-connect-button {
  flex: 0 0 auto;
}

.accounts-empty-state {
  display: grid;
  gap: 18px;
}

.accounts-empty-copy {
  display: grid;
  gap: 6px;
}

.accounts-empty-title {
  margin: 0;
}

.accounts-empty-text {
  margin: 0;
  color: #4b5563;
}

.accounts-empty-actions {
  display: flex;
  justify-content: flex-start;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.account-tile {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.account-tile-selected {
  border-color: #93c5fd;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
}

.account-tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.account-tile-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.account-tile-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  color: #111827;
}

.account-tile-id {
  margin: 0;
  color: #6b7280;
  word-break: break-all;
}

.account-tile-status {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 600;
  text-transform: lowercase;
}

.account-tile-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.account-meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
}

.account-tile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.account-tile-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.account-select-button {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  padding: 11px 14px;
  font-size: 14px;
  font-weight: 600;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.account-select-button:hover {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.account-select-button-active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.account-select-button-active:hover {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

@media (max-width: 720px) {
  .accounts-hero {
    align-items: stretch;
  }

  .accounts-connect-button,
  .accounts-empty-actions .primary-button {
    width: 100%;
  }

  .account-tile-footer {
    align-items: stretch;
  }

  .account-select-button {
    width: 100%;
  }
}
</style>
