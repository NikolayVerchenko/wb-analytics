<template>
  <div class="flex flex-col gap-2">
    <label class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45" for="account-select">
      Кабинет продавца
    </label>
    <div class="rounded-[20px] border border-sand/80 bg-white px-2 py-2 shadow-soft-inset">
      <select
        id="account-select"
        class="w-full rounded-[16px] border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-mint"
        :value="accountsStore.selectedAccountId ?? ''"
        :disabled="accountsStore.isLoading || accountsStore.items.length === 0"
        @change="onSelect"
      >
        <option v-if="accountsStore.items.length === 0" value="">Нет аккаунтов</option>
        <option
          v-for="account in accountsStore.items"
          :key="account.account_id"
          :value="account.account_id"
        >
          {{ account.seller_name || account.name || account.account_id }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAccountsStore } from '../../../entities/account/model/store'

const accountsStore = useAccountsStore()

function onSelect(event: Event) {
  const target = event.target as HTMLSelectElement
  accountsStore.selectAccount(target.value)
}
</script>
