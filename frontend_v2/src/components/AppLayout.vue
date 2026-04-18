<script setup lang="ts">
import {
  LineChart,
  Package,
  Truck,
  RefreshCcw,
  Settings,
  Bell,
  Search,
} from 'lucide-vue-next'
import type { RouteLocationRaw } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const props = withDefaults(
  defineProps<{
    userName?: string | null
    userEmail?: string | null
    selectedAccountId?: string | null
  }>(),
  {
    userName: null,
    userEmail: null,
    selectedAccountId: null,
  },
)

const navItems = [
  { name: 'Настройки', icon: Settings, href: '/settings' },
  { name: 'Экономика', icon: LineChart, href: '/economics' },
  { name: 'Остатки', icon: Package, href: '/stocks' },
  { name: 'Поставки', icon: Truck, href: '/supplies' },
  { name: 'Синхронизация', icon: RefreshCcw, href: '/sync' },
]

function navTarget(href: string): RouteLocationRaw {
  if (!['/economics', '/stocks', '/supplies', '/sync'].includes(href)) {
    return href
  }

  return {
    path: href,
    query: {
      account_id: props.selectedAccountId || undefined,
    },
  }
}

function getInitials(name: string | null): string {
  if (!name) {
    return 'UN'
  }
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (parts.length === 0) {
    return 'UN'
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}
</script>

<template>
  <!-- Главный контейнер на всю высоту экрана со светло-серым фоном -->
  <div class="flex min-h-screen w-full bg-zinc-50/50">
    
    <!-- Боковое меню (Sidebar) -->
    <aside class="hidden w-64 flex-col border-r bg-white md:flex">
      <div class="flex h-16 items-center border-b px-6">
        <span class="text-lg font-bold tracking-tight text-zinc-900">WB Analytics</span>
      </div>
      
      <nav class="flex-1 space-y-1 p-4">
        <router-link
          v-for="item in navItems"
          :key="item.name"
          :to="navTarget(item.href)"
          active-class="bg-zinc-100 !text-zinc-900"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.name }}
        </router-link>
      </nav>
      
      <!-- Блок пользователя внизу меню -->
      <div class="border-t p-4">
        <div class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-50 cursor-pointer transition-colors">
          <Avatar class="h-9 w-9">
            <AvatarImage src="https://github.com/shadcn.png" alt="user avatar" />
            <AvatarFallback>{{ getInitials(userName) }}</AvatarFallback>
          </Avatar>
          <div class="flex flex-col">
            <span class="text-sm font-medium text-zinc-900">{{ userName || 'Пользователь' }}</span>
            <span class="text-xs text-zinc-500">{{ userEmail || '—' }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Основная часть (Шапка + Контент) -->
    <div class="flex flex-1 flex-col">
      
      <!-- Шапка (Topbar) -->
      <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div class="flex items-center gap-4 md:hidden">
          <span class="text-lg font-bold text-zinc-900">WB Analytics</span>
        </div>
        
        <!-- Поиск (опционально) -->
        <div class="hidden max-w-md flex-1 items-center space-x-2 md:flex">
          <div class="relative w-full">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input type="search" placeholder="Поиск по артикулу..." class="w-full bg-zinc-50 pl-9 md:w-[300px]" />
          </div>
        </div>

        <!-- Действия в шапке -->
        <div class="flex items-center gap-4">
          <slot name="topbar-actions" />
          <Button variant="outline" size="icon" class="rounded-full">
            <Bell class="h-4 w-4 text-zinc-600" />
          </Button>
        </div>
      </header>

      <!-- Контент страницы -->
      <main class="flex-1 p-6 md:p-8">
        <div class="mx-auto max-w-7xl">
          <slot /> <!-- Сюда будут вставляться наши страницы -->
        </div>
      </main>
      
    </div>
  </div>
</template>