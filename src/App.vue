<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Верхнее меню -->
    <TopMenu />

    <!-- Основной контент -->
    <main class="max-w-7xl mx-auto px-4 py-8">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <!-- Toast-уведомления -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { provideDI } from './presentation/composables/useDependencyInjection'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from './presentation/stores/wbStore'
import TopMenu from './presentation/components/TopMenu.vue'
import ToastContainer from './presentation/components/ToastContainer.vue'
import { toastService } from './presentation/services/ToastService'
import { useAnalyticsStore } from './stores/analyticsStore'

// Предоставляем DI для дочерних компонентов
provideDI()

// Инициализируем analyticsStore и загружаем данные
const analyticsStore = useAnalyticsStore()

// Автозапуск синхронизации при загрузке страницы (если есть готовые к повтору периоды)
onMounted(async () => {
  // Загружаем данные из БД в store
  try {
    await analyticsStore.loadAllDataFromDb()
  } catch (error) {
    console.error('Ошибка при загрузке данных в store:', error)
  }
  // Небольшая задержка, чтобы не блокировать первоначальную загрузку UI
  setTimeout(async () => {
    try {
      // TODO: Восстановить после реализации wbStore
      // const store = useWbStore()
      
      // Проверяем наличие API ключа
      const apiKey = localStorage.getItem('wb_api_key')
      if (!apiKey) {
        return // Без API ключа синхронизация невозможна
      }

      // TODO: Восстановить после реализации DIContainer
      // Переинициализируем DIContainer с актуальным ключом из localStorage
      // try {
      //   const { container } = await import('@core/di/container')
      //   const containerWithReinit = container as typeof container & { reinitialize: (key?: string) => void }
      //   if (typeof containerWithReinit.reinitialize === 'function') {
      //     containerWithReinit.reinitialize()
      //   }
      // } catch (err) {
      //   console.warn('Не удалось переинициализировать DI контейнер при автозапуске:', err)
      // }

      // Проверяем первый запуск
      // TODO: Восстановить после реализации SyncCoordinator в новой архитектуре
      // try {
      //   const { container } = await import('@core/di/container')
      //   const syncCoordinator = container.getSyncCoordinator()
      //   const dataPersistence = container.getDataPersistenceService()

        // // Восстановление незавершенных задач после прерывания сессии
        // const recoveredCount = await syncCoordinator.recover()
        // if (recoveredCount > 0) {
        //   console.log(`🔄 [Recovery] Восстановлено ${recoveredCount} незавершенных задач`)
        // }

        // // Проверяем, является ли это первым запуском
        // const isFirstRun = await syncCoordinator.isFirstRun()
        // console.log(`🔍 Проверка первого запуска: isFirstRun = ${isFirstRun}`)
        
        // if (isFirstRun) {
        //   console.log('🆕 Первый запуск: база данных пуста. Создаем начальную очередь...')
          
        //   // Генерируем очередь для всех недель (для background синхронизации)
        //   const createdCount = await syncCoordinator.generateInitialSyncQueue()
        //   console.log(`✅ Создана очередь из ${createdCount} недель для фоновой загрузки`)
          
        //   if (createdCount === 0) {
        //     console.warn('⚠️ Предупреждение: очередь не была создана (0 недель). Возможно, недели уже существуют в реестре.')
        //   }
          
        //   // Автоматически запускаем синхронизацию (сначала foreground, потом background)
        //   // Не блокируем UI - пользователь сможет работать после загрузки критических данных
        //   store.startSync()
        //     .then(() => {
        //       console.log('✅ Критические данные загружены, фоновая синхронизация запущена')
        //     })
        //     .catch(error => {
        //       console.error('❌ Ошибка синхронизации:', error)
        //     })
        // } else {
        //   // Обычная проверка задач (foreground)
        //   const nextTask = await syncCoordinator.getNextForegroundTask()
          
        //   if (nextTask && !store.isSyncing) {
        //     console.log(`🔄 Автозапуск синхронизации: найдена задача для синхронизации (${nextTask.type}, период: ${nextTask.periodId})`)
            
        //     // Запускаем синхронизацию в фоне (не блокируя UI)
        //     store.startSync()
        //       .then(() => {
        //         console.log('✅ Автозапуск: синхронизация успешно завершена')
        //       })
        //       .catch(error => {
        //         console.error('❌ Ошибка автозапуска синхронизации:', error)
        //       })
        //   } else if (!nextTask) {
        //     // Дополнительная проверка: может быть база данных пуста, но не был обнаружен первый запуск?
        //     const stats = await syncCoordinator.getSyncStats()
        //     console.log(`📊 Статистика синхронизации:`, stats)
            
        //     // Проверяем наличие реальных данных
        //     const hasData = await dataPersistence.hasAnyData()
        //     console.log(`📊 Проверка наличия данных: hasData = ${hasData}`)
            
        //     // Если данных нет, создаем очередь (даже если есть записи в реестре)
        //     if (!hasData) {
        //       console.warn('⚠️ База данных пуста (нет данных продаж/возвратов). Создаем очередь для первого запуска...')
              
        //       try {
        //         // Очищаем старые записи в реестре, если они есть, но данных нет
        //         if (stats.total > 0) {
        //           console.log(`🧹 Очистка старых записей из реестра (${stats.total} записей)...`)
        //           const { db } = await import('@infrastructure/db/database')
        //           await db.syncRegistry.clear()
        //         }
                
        //         const createdCount = await syncCoordinator.generateInitialSyncQueue()
        //         console.log(`✅ Создана очередь из ${createdCount} недель (fallback - нет данных)`)
                
        //         if (createdCount > 0) {
        //           store.startSync()
        //             .then(() => {
        //               console.log('✅ Синхронизация завершена (fallback)')
        //             })
        //             .catch(error => {
        //               console.error('❌ Ошибка синхронизации (fallback):', error)
        //             })
        //         }
        //       } catch (err) {
        //         console.error('❌ Ошибка при создании очереди (fallback):', err)
        //       }
        //     } else {
        //       console.log('✅ Автозапуск: нет задач для синхронизации (все данные актуальны)')
        //     }
        //   } else if (store.isSyncing) {
        //     console.log('ℹ️ Автозапуск: синхронизация уже выполняется')
        //   }
        // }
      // } catch (err) {
      //   console.warn('Не удалось проверить задачи синхронизации при автозапуске:', err)
      //   console.error('Детали ошибки:', err)
      // }
    } catch (error) {
      console.error('Ошибка при проверке автозапуска синхронизации:', error)
    }
  }, 2000) // Задержка 2 секунды после загрузки страницы
})

</script>
