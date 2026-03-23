<template>
  <header class="topbar">
    <div class="topbar-brand">
      <span class="topbar-brand-wb">WB</span>
      <span class="topbar-brand-partners">Analytics</span>
    </div>

    <nav class="topbar-nav" aria-label="Основная навигация">
      <RouterLink
        v-for="item in navItems"
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

      <button type="button" class="topbar-profile-button">
        <span>{{ profileName }}</span>
        <span class="topbar-profile-arrow">⌄</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  profileName: string
}>()

const navItems = [
  { label: 'Аналитика', to: '/economics' },
  { label: 'Список аккаунтов', to: '/accounts' },
]
</script>
