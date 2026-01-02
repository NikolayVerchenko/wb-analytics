<template>
  <div class="relative">
    <!-- Кнопка открытия модального окна -->
    <button
      @click="openModal"
      class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      <Filter class="w-4 h-4" />
      <span>
        {{ buttonText }}
      </span>
    </button>

    <!-- Модальное окно через Teleport -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeModal"
        >
          <!-- Overlay с размытием -->
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Модальное окно -->
          <div
            class="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col mx-4 md:mx-0"
            @click.stop
          >
            <!-- Заголовок -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Выбор категорий</h3>
              <button
                @click="closeModal"
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Поиск -->
            <div class="p-4 border-b border-gray-200">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Поиск категорий..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <!-- Список категорий с чекбоксами -->
            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="filteredCategories.length === 0" class="text-center text-gray-500 py-8">
                Категории не найдены
              </div>
              <div v-else class="space-y-2">
                <label
                  v-for="category in filteredCategories"
                  :key="category"
                  class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="category"
                    v-model="selectedCategoriesLocal"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span class="text-sm text-gray-700 flex-1">{{ category }}</span>
                </label>
              </div>
            </div>

            <!-- Кнопки управления -->
            <div class="p-4 border-t border-gray-200 space-y-3">
              <!-- Вспомогательные кнопки -->
              <div class="flex gap-2">
                <button
                  @click="selectAll"
                  class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Выбрать все
                </button>
                <button
                  @click="clearAll"
                  class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Сбросить всё
                </button>
              </div>
              
              <!-- Основная кнопка -->
              <button
                @click="applySelection"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Применить ({{ selectedCategoriesLocal.length }})
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Filter, X, Search } from 'lucide-vue-next'
import { container } from '@core/di/container'
// TODO: Восстановить после реализации filterStore
// import { useFilterStore } from '../stores/filterStore'
import { CategoryService } from '@core/services/CategoryService'

// TODO: Восстановить после реализации filterStore
// const filterStore = useFilterStore()
const filterStore = {
  selectedCategories: [] as string[] | undefined,
  setSelectedCategories: (categories: string[] | undefined) => {
    console.log('setSelectedCategories called (stub):', categories)
  },
}

const isOpen = ref(false)
const searchQuery = ref('')
const categories = ref<string[]>([])
const selectedCategoriesLocal = ref<string[]>([])

// TODO: Восстановить после реализации репозиториев в container
// Использование репозиториев из контейнера
// const saleRepository = container.getReportSaleRepository()
// const returnRepository = container.getReportReturnRepository()
// const categoryService = new CategoryService(saleRepository, returnRepository)
const categoryService = null as any

// Загружаем категории при монтировании компонента
onMounted(async () => {
  try {
    // TODO: Восстановить после реализации categoryService
    // categories.value = await categoryService.getUniqueCategories()
    categories.value = []
    // Инициализируем selectedCategoriesLocal из store
    if (filterStore.selectedCategories && filterStore.selectedCategories.length > 0) {
      selectedCategoriesLocal.value = [...filterStore.selectedCategories]
    }
  } catch (error) {
    console.error('Ошибка загрузки категорий:', error)
  }
})

// Отфильтрованные категории по поисковому запросу
const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) {
    return categories.value
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return categories.value.filter(category =>
    category.toLowerCase().includes(query)
  )
})

// Текст кнопки
const buttonText = computed(() => {
  const count = filterStore.selectedCategories?.length || 0
  if (count === 0) {
    return 'Категории'
  }
  return `Категории: ${count}`
})

// Открытие модального окна
const openModal = () => {
  // Синхронизируем локальное состояние с store при открытии
  selectedCategoriesLocal.value = filterStore.selectedCategories ? [...filterStore.selectedCategories] : []
  isOpen.value = true
}

// Закрытие модального окна
const closeModal = () => {
  isOpen.value = false
  // Сбрасываем поисковый запрос при закрытии
  searchQuery.value = ''
}

// Выбрать все видимые категории
const selectAll = () => {
  selectedCategoriesLocal.value = [...filteredCategories.value]
}

// Сбросить все выбранные категории
const clearAll = () => {
  selectedCategoriesLocal.value = []
}

// Применить выбранные категории
const applySelection = () => {
  filterStore.setSelectedCategories(selectedCategoriesLocal.value.length > 0 ? selectedCategoriesLocal.value : undefined)
  closeModal()
}

// Закрытие по Escape
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    closeModal()
  }
}

// Добавляем обработчик Escape при открытии модалки
watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('keydown', handleEscape)
  }
})
</script>
