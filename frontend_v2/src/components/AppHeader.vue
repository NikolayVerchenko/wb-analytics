<template>
  <header class="topbar">
    <div class="topbar-brand">
      <span class="topbar-brand-wb">WB</span>
      <span class="topbar-brand-partners">Analytics</span>
    </div>

    <nav class="topbar-nav" aria-label="Основная навигация">
      <RouterLink
        v-for="item in visibleNavItems"
        :key="item.label"
        :to="item.to"
        class="topbar-nav-link"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="topbar-actions">
      <button type="button" class="topbar-icon-button" aria-label="Поиск">⌕</button>
      <button type="button" class="topbar-icon-button" aria-label="Сообщения">◫</button>
      <button type="button" class="topbar-icon-button topbar-icon-badge" aria-label="Уведомления">
        ◌
        <span class="topbar-badge">99+</span>
      </button>
      <button type="button" class="topbar-icon-button" aria-label="Помощь">?</button>

      <div v-if="isAuthenticated && userLabel" class="topbar-user-badge">
        <span class="topbar-user-caption">Пользователь</span>
        <span class="topbar-user-name">{{ userLabel }}</span>
      </div>

      <button
        v-if="isAuthenticated"
        type="button"
        class="topbar-logout-button"
        @click="$emit('logout')"
      >
        Выйти
      </button>

      <label v-if="isAuthenticated" class="topbar-account-picker">
        <span class="topbar-account-picker-caption">Кабинет</span>
        <select class="topbar-account-select" :value="selectedAccountId || ''" @change="handleAccountChange">
          <option value="">Выберите кабинет</option>
          <option v-for="account in accounts" :key="account.account_id" :value="account.account_id">
            {{ account.seller_name || account.name || account.account_id }}
          </option>
        </select>
      </label>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Account } from '../types/account'

const props = defineProps<{
  accounts: Account[]
  selectedAccountId?: string | null
  userName?: string | null
  userEmail?: string | null
  isAuthenticated: boolean
}>()

const emit = defineEmits<{
  logout: []
  'select-account': [accountId: string | null]
}>()

const navItems = computed(() => {
  const accountQuery = props.selectedAccountId ? { account_id: props.selectedAccountId } : undefined

  return [
    { label: 'Проблемные товары', to: { path: '/economics/problems', query: accountQuery }, authOnly: true },
    { label: 'Полная аналитика', to: { path: '/economics', query: accountQuery }, authOnly: true },
    { label: 'Остатки', to: { path: '/stocks', query: accountQuery }, authOnly: true },
    { label: 'Поставки', to: { path: '/supplies', query: accountQuery }, authOnly: true },
    { label: 'Загрузка данных', to: { path: '/sync', query: accountQuery }, authOnly: true },
    { label: 'Список аккаунтов', to: { path: '/accounts' }, authOnly: true },
    { label: 'Регистрация', to: { path: '/register' }, authOnly: false },
  ]
})

const visibleNavItems = computed(() =>
  navItems.value.filter((item) => (item.authOnly ? props.isAuthenticated : !props.isAuthenticated)),
)

const userLabel = computed(() => props.userName || props.userEmail || '')

function handleAccountChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('select-account', value || null)
}
</script>

<style scoped>
.topbar-user-badge {
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
}

.topbar-user-caption {
  font-size: 11px;
  line-height: 1;
  color: #9ca3af;
}

.topbar-user-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.topbar-logout-button {
  height: 42px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
}

.topbar-logout-button:hover {
  border-color: #d1d5db;
  color: #111827;
  background: #f8fafc;
}

.topbar-account-picker {
  min-width: 230px;
  display: grid;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
}

.topbar-account-picker-caption {
  font-size: 11px;
  line-height: 1;
  color: #9ca3af;
}

.topbar-account-select {
  border: none;
  background: transparent;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  padding: 0;
}

.topbar-account-select:focus {
  outline: none;
}
</style>

