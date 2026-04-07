<template>
  <section class="rounded-[28px] border border-sand/90 bg-white/80 p-6 shadow-panel backdrop-blur">
    <div class="flex flex-col gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-clay">Кабинет</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight text-ink">Выбор аккаунта</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
          Это страница управления аккаунтами. Здесь мы не просто показываем выбранный кабинет,
          а даем пользователю осознанно переключить общий контекст всего приложения.
        </p>
      </div>

      <div v-if="accountsStore.isLoading" class="rounded-2xl bg-paper px-4 py-3 text-sm text-ink/70">
        Загружаю аккаунты...
      </div>

      <div v-else-if="accountsStore.errorMessage" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Не удалось загрузить аккаунты: {{ accountsStore.errorMessage }}
      </div>

      <div v-else class="grid gap-3">
        <button
          v-for="account in accountsStore.items"
          :key="account.account_id"
          type="button"
          class="rounded-2xl border px-4 py-4 text-left transition"
          :class="account.account_id === accountsStore.selectedAccountId
            ? 'border-clay bg-clay/10 shadow-sm'
            : 'border-sand bg-white hover:border-clay/60 hover:bg-paper'"
          @click="accountsStore.selectAccount(account.account_id)"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-base font-semibold text-ink">{{ account.seller_name || account.name || 'Без названия' }}</p>
              <p class="mt-1 text-sm text-ink/60">{{ account.trade_mark || 'Торговая марка не указана' }}</p>
            </div>
            <span class="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-ink/55">
              {{ account.status || 'unknown' }}
            </span>
          </div>
          <dl class="mt-4 grid gap-2 text-sm text-ink/70 sm:grid-cols-2">
            <div>
              <dt class="text-[11px] uppercase tracking-[0.18em] text-ink/45">account_id</dt>
              <dd class="mt-1 break-all font-mono text-xs">{{ account.account_id }}</dd>
            </div>
            <div>
              <dt class="text-[11px] uppercase tracking-[0.18em] text-ink/45">wb_seller_id</dt>
              <dd class="mt-1 break-all font-mono text-xs">{{ account.wb_seller_id || '—' }}</dd>
            </div>
          </dl>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useAccountsStore } from '../../../entities/account/model/store'

const accountsStore = useAccountsStore()

onMounted(() => {
  void accountsStore.initialize()
})
</script>
