<template>
  <div class="relative">
    <!-- Кнопка открытия модального окна -->
    <button
      @click="openModal"
      class="relative flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      <Filter class="w-4 h-4" />
      <span>Артикулы</span>
      <!-- Badge индикатор -->
      <span
        v-if="selectedCount > 0"
        class="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs font-semibold rounded-full"
      >
        {{ selectedCount }}
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
              <h3 class="text-lg font-semibold text-gray-900">Выбор артикулов</h3>
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
                  placeholder="Поиск артикулов..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <!-- Групповые действия -->
            <div class="px-4 pt-4 border-b border-gray-200 pb-2">
              <div class="flex gap-2">
                <button
                  @click="selectAll"
                  class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Выбрать все видимые
                </button>
                <button
                  @click="clearAll"
                  class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Снять выделение
                </button>
              </div>
            </div>

            <!-- Список артикулов с чекбоксами -->
            <div class="flex-1 overflow-y-auto p-4 max-h-[400px]">
              <div v-if="filteredVendorCodes.length === 0" class="text-center text-gray-500 py-8">
                Артикулы не найдены
              </div>
              <div v-else class="space-y-2">
                <label
                  v-for="vendorCode in filteredVendorCodes"
                  :key="vendorCode.sa_name"
                  class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="vendorCode.sa_name"
                    v-model="selectedVendorCodesLocal"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <div class="flex-1 flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-900">{{ vendorCode.sa_name }}</span>
                    <span v-if="vendorCode.brand_name" class="text-xs text-gray-500 ml-2">
                      {{ vendorCode.brand_name }}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Footer с кнопками -->
            <div class="p-4 border-t border-gray-200">
              <div class="flex gap-3">
                <button
                  @click="closeModal"
                  class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  @click="applySelection"
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Применить ({{ selectedVendorCodesLocal.length }})
                </button>
              </div>
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
import { VendorCodeService, type VendorCodeInfo } from '@core/services/VendorCodeService'

// TODO: Восстановить после реализации filterStore
// const filterStore = useFilterStore()
const filterStore = {
  selectedVendorCodes: [] as string[] | undefined,
  setSelectedVendorCodes: (codes: string[] | undefined) => {
    console.log('setSelectedVendorCodes called (stub):', codes)
  },
}

const isOpen = ref(false)
const searchQuery = ref('')
const vendorCodes = ref<VendorCodeInfo[]>([])
const selectedVendorCodesLocal = ref<string[]>([])

// TODO: Восстановить после реализации репозиториев в container
// Использование репозиториев из контейнера
// const saleRepository = container.getReportSaleRepository()
// const returnRepository = container.getReportReturnRepository()
// const vendorCodeService = new VendorCodeService(saleRepository, returnRepository)
const vendorCodeService = null as any

// Загружаем артикулы при монтировании компонента
onMounted(async () => {
  try {
    // TODO: Восстановить после реализации vendorCodeService
    // vendorCodes.value = await vendorCodeService.getUniqueVendorCodes()
    vendorCodes.value = []
    // Инициализируем selectedVendorCodesLocal из store
    if (filterStore.selectedVendorCodes && filterStore.selectedVendorCodes.length > 0) {
      selectedVendorCodesLocal.value = [...filterStore.selectedVendorCodes]
    }
  } catch (error) {
    console.error('Ошибка загрузки артикулов:', error)
  }
})

// Отфильтрованные артикулы по поисковому запросу (computed для мгновенной фильтрации)
const filteredVendorCodes = computed(() => {
  if (!searchQuery.value.trim()) {
    return vendorCodes.value
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return vendorCodes.value.filter(vc =>
    vc.sa_name.toLowerCase().includes(query) ||
    (vc.brand_name && vc.brand_name.toLowerCase().includes(query))
  )
})

// Количество выбранных артикулов для badge
const selectedCount = computed(() => {
  return filterStore.selectedVendorCodes?.length || 0
})

// Открытие модального окна
const openModal = () => {
  // Синхронизируем локальное состояние с store при открытии
  selectedVendorCodesLocal.value = filterStore.selectedVendorCodes ? [...filterStore.selectedVendorCodes] : []
  isOpen.value = true
}

// Закрытие модального окна
const closeModal = () => {
  isOpen.value = false
  // Сбрасываем поисковый запрос при закрытии
  searchQuery.value = ''
}

// Выбрать все видимые артикулы
const selectAll = () => {
  const visibleSaNames = filteredVendorCodes.value.map(vc => vc.sa_name)
  // Объединяем с уже выбранными, чтобы не потерять выбор вне видимой области
  const currentSelected = new Set(selectedVendorCodesLocal.value)
  visibleSaNames.forEach(saName => currentSelected.add(saName))
  selectedVendorCodesLocal.value = Array.from(currentSelected)
}

// Снять выделение со всех видимых артикулов
const clearAll = () => {
  const visibleSaNames = new Set(filteredVendorCodes.value.map(vc => vc.sa_name))
  selectedVendorCodesLocal.value = selectedVendorCodesLocal.value.filter(
    saName => !visibleSaNames.has(saName)
  )
}

// Применить выбранные артикулы
const applySelection = () => {
  filterStore.setSelectedVendorCodes(selectedVendorCodesLocal.value.length > 0 ? selectedVendorCodesLocal.value : undefined)
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
