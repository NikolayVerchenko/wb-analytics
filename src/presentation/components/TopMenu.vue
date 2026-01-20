<template>
  <div>
    <!-- Основное меню -->
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <!-- Логотип/Название -->
          <div class="flex-shrink-0">
            <h1 class="text-2xl font-bold text-gray-900">WB Analytics</h1>
          </div>

          <!-- Навигационные ссылки -->
          <div class="flex space-x-1 items-center">
            <router-link
              v-for="item in menuItems"
              :key="item.path"
              :to="item.path"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative"
              :class="[
                route.path === item.path
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              ]"
            >
              <component :is="item.icon" class="w-5 h-5" />
              <span>{{ item.label }}</span>
              
              <!-- Индикатор активной синхронизации на иконке настроек -->
              <span
                v-if="item.path === '/settings' && (store.isSyncing || store.isBackgroundSyncing)"
                class="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                title="Синхронизация в процессе"
              />
            </router-link>
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { LayoutDashboard, FileText, Settings, Package, ShoppingCart, Truck, TrendingUp, Layers, List, HeartPulse } from 'lucide-vue-next'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '../stores/wbStore'

// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
const store = {
  isSyncing: false,
  isBackgroundSyncing: false,
}

const route = useRoute()

interface MenuItem {
  path: string
  label: string
  icon: any
}

const menuItems: MenuItem[] = [
  { path: '/', label: 'Дашборд', icon: LayoutDashboard },
  { path: '/pulse', label: 'Пульс', icon: HeartPulse },
  { path: '/summary', label: 'Сводка', icon: FileText },
  { path: '/products', label: 'Товары', icon: Package },
  { path: '/purchases', label: 'Закупки', icon: ShoppingCart },
  { path: '/shipments', label: 'Поставки', icon: Truck },
  { path: '/batches', label: 'Партии', icon: Layers },
  { path: '/finance', label: 'Финансы', icon: TrendingUp },
  { path: '/startup-logs', label: 'Логи', icon: List },
  { path: '/settings', label: 'Настройки', icon: Settings },
]
</script>
