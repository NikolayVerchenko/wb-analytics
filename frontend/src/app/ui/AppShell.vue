<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useAccountsStore } from '../../entities/account/model/store'

type NavItem = {
  label: string
  path: string
}

const route = useRoute()
const accountsStore = useAccountsStore()

const navItems: NavItem[] = [
  { label: 'Экономика', path: '/economics' },
  { label: 'Поставки', path: '/supplies' },
  { label: 'Настройки', path: '/accounts' },
]

const activeAccountName = computed(() => {
  return accountsStore.selectedAccount?.seller_name ?? accountsStore.selectedAccount?.name ?? 'Кабинет не выбран'
})

const isActive = (path: string) => route.path.startsWith(path)
</script>

<template>
  <div class="min-h-screen bg-[#f7f7f4] text-stone-900">
    <header
      class="z-50 border-b border-stone-200 bg-white"
      style="position: fixed; top: 0; left: 0; right: 0;"
    >
      <div class="mx-auto flex h-12 max-w-[1680px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <RouterLink
          to="/economics"
          class="flex shrink-0 items-center gap-2 border-r border-stone-200 pr-4 text-sm font-semibold tracking-[0.24em] text-stone-700 transition"
        >
          <span class="text-lg font-black tracking-normal text-[#5d7252]">wb</span>
          <span>ANALYTICS</span>
        </RouterLink>

        <nav class="min-w-0 flex-1 overflow-x-auto">
          <div class="flex min-w-max items-center gap-1.5">
            <RouterLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="px-3 py-1.5 text-sm font-medium text-stone-600 transition"
              :class="
                isActive(item.path)
                  ? 'border-b-2 border-stone-900 text-stone-950'
                  : 'border-b-2 border-transparent hover:text-stone-900'
              "
            >
              {{ item.label }}
            </RouterLink>
          </div>
        </nav>

        <div class="hidden items-center gap-2 border-l border-stone-200 pl-4 text-sm text-stone-700 md:flex">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef3eb] text-xs font-semibold uppercase text-[#5d7252]">
            {{ activeAccountName.slice(0, 1) }}
          </span>
          <span class="max-w-[220px] truncate font-medium">{{ activeAccountName }}</span>
        </div>
      </div>
    </header>

    <div class="h-14" aria-hidden="true"></div>

    <main
      class="mx-auto max-w-[1680px] px-4 pb-8 pt-4 sm:px-6 lg:px-8"
      :class="{ 'economics-page-host': route.path.startsWith('/economics') }"
    >
      <RouterView />
    </main>
  </div>
</template>
