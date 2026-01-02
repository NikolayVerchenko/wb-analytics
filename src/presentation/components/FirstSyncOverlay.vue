<template>
  <Transition name="overlay">
    <div
      v-if="show"
      class="first-sync-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="handleBackgroundClick"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-8">
        <!-- Заголовок -->
        <div class="text-center mb-6">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">
            Первая синхронизация данных
          </h2>
          <p class="text-gray-600">
            Загружаем историю продаж и возвратов с {{ minDate }} по сегодня
          </p>
        </div>

        <!-- Прогресс-бар -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-gray-700">
              Прогресс загрузки
            </span>
            <span class="text-sm font-semibold text-blue-600">
              {{ stats.success }} / {{ stats.total }} недель
            </span>
          </div>
          
          <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              class="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
              :style="{ width: `${progressPercentage}%` }"
            >
              <span v-if="progressPercentage > 10" class="text-xs font-semibold text-white">
                {{ Math.round(progressPercentage) }}%
              </span>
            </div>
          </div>

          <!-- Детальная статистика -->
          <div class="mt-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-blue-600">{{ stats.success }}</div>
              <div class="text-xs text-gray-600">Загружено</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-orange-600">{{ stats.pending }}</div>
              <div class="text-xs text-gray-600">В очереди</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-600">{{ stats.waiting }}</div>
              <div class="text-xs text-gray-600">Ожидание</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-600">{{ stats.failed }}</div>
              <div class="text-xs text-gray-600">Ошибки</div>
            </div>
          </div>
        </div>

        <!-- Сообщение о статусе -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <Loader2 :class="{ 'animate-spin': isSyncing }" class="w-5 h-5 text-blue-600" />
            <p class="text-sm text-blue-800">
              {{ statusMessage }}
            </p>
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="flex gap-3">
          <button
            v-if="!isSyncing && stats.pending > 0"
            @click="handleSkipToLastWeeks"
            class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            Пропустить и загрузить только последние 2 недели
          </button>
          
          <button
            v-if="!isSyncing && stats.pending === 0"
            @click="handleClose"
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Продолжить
          </button>
        </div>

        <!-- Информация -->
        <div class="mt-6 pt-6 border-t border-gray-200">
          <p class="text-xs text-gray-500 text-center">
            После завершения исторической загрузки система автоматически перейдет в обычный режим синхронизации (Daily/Weekly)
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { container } from '@core/di/container'
// TODO: Восстановить после реализации wbStore
// import { useWbStore } from '../stores/wbStore'

interface Props {
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  skipToLastWeeks: []
}>()

// TODO: Восстановить после реализации wbStore
// const store = useWbStore()
const store = {
  isSyncing: false,
}
const stats = ref({ total: 0, pending: 0, success: 0, waiting: 0, failed: 0 })
const statusMessage = ref('Инициализация...')
const minDate = '29.01.2024'

let statsInterval: number | null = null

const isSyncing = computed(() => store.isSyncing)

const progressPercentage = computed(() => {
  if (stats.value.total === 0) return 0
  return (stats.value.success / stats.value.total) * 100
})

const updateStats = async () => {
  try {
    // TODO: Восстановить после реализации SyncCoordinator
    // const coordinator = container.getSyncCoordinator()
    // const newStats = await coordinator.getSyncStats()
    // stats.value = newStats
    stats.value = { total: 0, pending: 0, waiting: 0, success: 0, failed: 0 }

    // Обновляем сообщение о статусе
    if (store.isSyncing) {
      statusMessage.value = 'Идет синхронизация данных...'
    } else if (stats.value.pending > 0) {
      statusMessage.value = `Ожидание запуска синхронизации... (${stats.value.pending} недель в очереди)`
    } else if (stats.value.waiting > 0) {
      statusMessage.value = `Ожидание данных от Wildberries... (${stats.value.waiting} периодов)`
    } else if (stats.value.failed > 0) {
      statusMessage.value = `Завершено с ошибками. ${stats.value.success} недель загружено, ${stats.value.failed} ошибок`
    } else if (stats.value.success > 0) {
      statusMessage.value = `Все данные загружены! (${stats.value.success} недель)`
    } else {
      statusMessage.value = 'Подготовка к синхронизации...'
    }
  } catch (error) {
    console.error('Ошибка при обновлении статистики:', error)
  }
}

const handleSkipToLastWeeks = async () => {
  try {
    // TODO: Восстановить после реализации SyncCoordinator
    // const coordinator = container.getSyncCoordinator()
    statusMessage.value = 'Функция временно недоступна'
    
    // // Удаляем все pending задачи
    // const { db } = await import('@infrastructure/db/database')
    // const allPending = await db.syncRegistry.where('status').equals('pending').toArray()
    // const idsToDelete = allPending.map(e => e.id!).filter((id): id is number => id !== undefined)
    // if (idsToDelete.length > 0) {
    //   await db.syncRegistry.bulkDelete(idsToDelete)
    // }

    // // Создаем очередь только для последних 2 недель
    // await coordinator.generateLastWeeksQueue(2)
    
    // statusMessage.value = 'Очередь создана. Запуск синхронизации...'
    // emit('skipToLastWeeks')
    
    // // Запускаем синхронизацию
    // store.startSync()
    //   .then(() => {
    //     console.log('✅ Синхронизация последних недель завершена')
    //   })
    //   .catch(error => {
    //     console.error('❌ Ошибка синхронизации:', error)
    //   })
    
    // // Обновляем статистику
    // await updateStats()
  } catch (error) {
    console.error('Ошибка при пропуске истории:', error)
    statusMessage.value = 'Ошибка при создании очереди'
  }
}

const handleClose = () => {
  emit('close')
}

const handleBackgroundClick = () => {
  // Не закрываем при клике на фон во время синхронизации
  if (!store.isSyncing && stats.value.pending === 0) {
    handleClose()
  }
}

watch(() => props.show, (newValue) => {
  if (newValue) {
    updateStats()
    // Обновляем статистику каждые 2 секунды
    statsInterval = window.setInterval(() => {
      updateStats()
    }, 2000)
  } else {
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
    }
  }
})

// Закрываем оверлей когда синхронизация завершена и нет pending задач
watch([() => store.isSyncing, () => stats.value.pending], ([isSyncing, pending]) => {
  if (props.show && !isSyncing && pending === 0 && stats.value.success > 0) {
    // Даем немного времени на завершение всех операций
    setTimeout(() => {
      handleClose()
    }, 2000)
  }
})

onMounted(() => {
  if (props.show) {
    updateStats()
    statsInterval = window.setInterval(() => {
      updateStats()
    }, 2000)
  }
})

onBeforeUnmount(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
})
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
