<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Верхнее меню -->
    <TopMenu />

    <!-- Основной контент -->
    <main :class="mainClass">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <!-- Toast-уведомления -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { provideDI } from './presentation/composables/useDependencyInjection'
import TopMenu from './presentation/components/TopMenu.vue'
import ToastContainer from './presentation/components/ToastContainer.vue'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { container } from '@/core/di/container'
import { TOKENS } from '@/core/di/tokens'
import { useWeeklyReportAutoSync } from '@/presentation/composables/useWeeklyReportAutoSync'
import { useDataFreshnessCatchupAuto } from '@/presentation/composables/useDataFreshnessCatchupAuto'

// Предоставляем DI для дочерних компонентов
provideDI()

// Инициализируем analyticsStore и загружаем данные
const analyticsStore = useAnalyticsStore()
const weeklyAutoSync = useWeeklyReportAutoSync()
const freshnessCatchup = useDataFreshnessCatchupAuto()
const route = useRoute()
const mainClass = computed(() => {
  const isSummary = route.path === '/summary'
  return isSummary
    ? 'max-w-[calc(100vw-32px)] mx-auto px-4 py-8'
    : 'max-w-7xl mx-auto px-4 py-8'
})

onMounted(async () => {
  analyticsStore.addStartupLog({ level: 'info', message: 'Приложение запущено' })
  analyticsStore.initializeServices(
    container.resolve(TOKENS.dataLoadingService),
    container.resolve(TOKENS.reportAggregationService),
    container.resolve(TOKENS.supplyService)
  )

  // Загружаем данные из БД в store
  try {
    analyticsStore.addStartupLog({ level: 'info', message: 'Загрузка данных из БД: начало' })
    await analyticsStore.loadAllDataFromDb()
    analyticsStore.addStartupLog({ level: 'info', message: 'Загрузка данных из БД: завершено' })
  } catch (error) {
    console.error('Ошибка при загрузке данных в store:', error)
    analyticsStore.addStartupLog({
      level: 'error',
      message: `Загрузка данных из БД: ошибка`,
    })
  }

  analyticsStore.addStartupLog({ level: 'info', message: 'Проверка свежести: запуск' })
  await freshnessCatchup.start()
  analyticsStore.addStartupLog({ level: 'info', message: 'Проверка свежести: завершено' })
  weeklyAutoSync.start()
})

</script>
