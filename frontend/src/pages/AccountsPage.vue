<template>
  <main class="flex flex-col gap-6">
    <section class="rounded-[26px] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-clay">Управление контекстом</p>
          <h2 class="mt-2.5 text-[30px] font-semibold tracking-tight text-ink">Настройки кабинета</h2>
          <p class="mt-2.5 max-w-3xl text-[14px] leading-6 text-ink/70">
            Здесь живут глобальные настройки приложения: выбор активного кабинета и ставка налога.
            Это отдельный экран, чтобы не занимать место на рабочих аналитических страницах.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
          <div class="rounded-[20px] border border-sand/70 bg-paper/70 px-4 py-3.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/42">Контекст</p>
            <p class="mt-2 text-[15px] font-semibold text-ink">Активный кабинет</p>
          </div>
          <div class="rounded-[20px] border border-sand/70 bg-paper/70 px-4 py-3.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/42">Финансы</p>
            <p class="mt-2 text-[15px] font-semibold text-ink">Налоговая ставка</p>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <AccountSelect />
      <TaxRateCard :account-id="accountsStore.selectedAccountId" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useAccountsStore } from '../entities/account/model/store'
import AccountSelect from '../features/account-select/ui/AccountSelect.vue'
import TaxRateCard from '../features/tax-settings/ui/TaxRateCard.vue'

const accountsStore = useAccountsStore()

onMounted(() => {
  void accountsStore.initialize()
})
</script>
