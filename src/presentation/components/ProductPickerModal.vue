<template>
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
        class="fixed inset-0 z-50 overflow-y-auto"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            class="relative bg-white rounded-2xl shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-gray-900">Выбор товаров</h3>
                <p class="text-sm text-gray-500 mt-1">
                  Выберите товары и размеры для добавления в закупку
                </p>
              </div>
              <button
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Split View Content -->
            <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <!-- Left Panel: Search and Products -->
              <div class="flex-1 flex flex-col border-r border-gray-200 lg:w-[65%]">
                <!-- Search -->
                <div class="p-4 border-b border-gray-200 flex-shrink-0">
                  <div class="relative">
                    <svg
                      class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      ref="searchInput"
                      v-model="searchQuery"
                      type="text"
                      placeholder="Поиск по названию, nmID, vendor..."
                      class="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      @keydown.esc.stop="handleClose"
                    />
                  </div>
                </div>

                <!-- Products Grid -->
                <div class="flex-1 overflow-y-auto p-4">
                  <!-- Empty State -->
                  <div v-if="filteredProducts.length === 0" class="text-center text-gray-500 py-12">
                    <svg
                      class="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p class="text-lg font-medium">Товары не найдены</p>
                    <p class="text-sm mt-1">Попробуйте изменить поисковый запрос</p>
                  </div>

                  <!-- Products Grid -->
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ProductCardSelect
                      v-for="product in filteredProducts"
                      :key="product.ni"
                      :product="product"
                      :checked="selectedNmIdSet.has(product.ni)"
                      @toggle="handleToggleProduct"
                    />
                  </div>
                </div>
              </div>

              <!-- Right Panel: Selected Products -->
              <div class="flex-1 lg:w-[35%] border-t lg:border-t-0 border-gray-200">
                <div class="h-full p-4">
                  <SelectedProductsPanel
                    :selected-products="selectedProducts"
                    :selected-sizes-by-nm-id="selectedSizesByNmId"
                    :sizes-by-nm-id="effectiveSizesByNmId"
                    @update-sizes="handleUpdateSizes"
                    @remove-selected="handleRemoveSelected"
                  />
                </div>
              </div>
            </div>

            <!-- Sticky Footer -->
            <ModalStickyFooter
              :can-confirm="canConfirm"
              :confirm-label="confirmLabel"
              :ready-info="readyInfo"
              @cancel="handleClose"
              @confirm="handleConfirm"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import type { IProductCard } from '../../types/db'
import ProductCardSelect from './purchases/ProductCardSelect.vue'
import SelectedProductsPanel from './purchases/SelectedProductsPanel.vue'
import ModalStickyFooter from './purchases/ModalStickyFooter.vue'

interface Props {
  isOpen: boolean
  products?: IProductCard[] // опционально, если не передано - берём из store
  resolveSizes?: (product: IProductCard) => Promise<string[]> | string[]
  initialSearch?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialSearch: '',
})

const emit = defineEmits<{
  close: []
  confirm: [payload: Array<{ product: IProductCard; sizes: string[] }>]
}>()

// Если products не переданы, получаем из store
import { useAnalyticsStore } from '../../stores/analyticsStore'
const store = useAnalyticsStore()
const productCards = computed(() => props.products || store.productCards)

const searchInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref(props.initialSearch)
const debouncedSearchText = ref(props.initialSearch)

// State для выбранных товаров (массив для реактивности)
const selectedNmIds = ref<number[]>([])
const selectedNmIdSet = computed(() => new Set(selectedNmIds.value))
const selectedSizesByNmId = ref<Record<number, string[]>>({})
const sizesByNmId = ref<Record<number, string[]>>({}) // кэш размеров

let debounceTimer: number | null = null

// Debounce поискового запроса (300ms)
watch(
  searchQuery,
  (newQuery) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = window.setTimeout(() => {
      debouncedSearchText.value = newQuery
    }, 300)
  },
  { immediate: true }
)

// Очистка таймера при размонтировании
onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})

// Группировка товаров по nmID (уникальные товары)
const uniqueProducts = computed<IProductCard[]>(() => {
  const productMap = new Map<number, IProductCard>()

  for (const card of productCards.value) {
    // Сохраняем первый экземпляр товара (для отображения)
    if (!productMap.has(card.ni)) {
      productMap.set(card.ni, card)
    }
  }

  return Array.from(productMap.values())
})

// Сбор размеров для всех товаров (computed для реактивности)
const allSizesByNmId = computed<Record<number, string[]>>(() => {
  const sizesMap: Record<number, string[]> = {}

  for (const card of productCards.value) {
    if (card.sz) {
      if (!sizesMap[card.ni]) {
        sizesMap[card.ni] = []
      }
      if (!sizesMap[card.ni].includes(card.sz)) {
        sizesMap[card.ni].push(card.sz)
      }
    }
  }

  return sizesMap
})

// Фильтрация товаров
const filteredProducts = computed(() => {
  const query = debouncedSearchText.value.trim().toLowerCase()

  if (!query) {
    return uniqueProducts.value
  }

  return uniqueProducts.value.filter((product) => {
    const titleMatch = product.title?.toLowerCase().includes(query) ?? false
    const nmIdMatch = product.ni.toString().includes(query)
    const vendorMatch = product.sa?.toLowerCase().includes(query) ?? false

    return titleMatch || nmIdMatch || vendorMatch
  })
})

// Выбранные товары
const selectedProducts = computed(() => {
  return uniqueProducts.value.filter((product) => selectedNmIdSet.value.has(product.ni))
})

// Эффективные размеры: объединяем sizesByNmId (загруженные) и allSizesByNmId (из каталога)
const effectiveSizesByNmId = computed<Record<number, string[]>>(() => {
  const result: Record<number, string[]> = { ...allSizesByNmId.value }
  // Перезаписываем те, что были загружены через resolveSizes
  Object.keys(sizesByNmId.value).forEach((nmIdStr) => {
    const nmId = Number(nmIdStr)
    result[nmId] = sizesByNmId.value[nmId]
  })
  return result
})

// Счётчики
const selectedCount = computed(() => selectedProducts.value.length)
const readyCount = computed(() => {
  return selectedProducts.value.filter((product) => {
    const sizes = selectedSizesByNmId.value[product.ni] || []
    return sizes.length > 0
  }).length
})

// Валидация
const canConfirm = computed(() => {
  return selectedCount.value > 0 && readyCount.value === selectedCount.value
})

// Label для кнопки
const confirmLabel = computed(() => {
  if (selectedCount.value === 0) {
    return 'Добавить товары'
  }
  return `Добавить ${selectedCount.value} товаров`
})

// Дополнительная информация (опционально)
const readyInfo = computed(() => {
  if (selectedCount.value === 0) {
    return undefined
  }
  return `Готово: ${readyCount.value}/${selectedCount.value}`
})

// Обработка toggle товара
const handleToggleProduct = async (payload: { nmID: number; checked: boolean }) => {
  const { nmID, checked } = payload

  if (checked) {
    // Добавляем товар
    if (!selectedNmIds.value.includes(nmID)) {
      selectedNmIds.value = [...selectedNmIds.value, nmID]
    }

    // Загружаем размеры, если их нет в кэше
    if (!sizesByNmId.value[nmID] || sizesByNmId.value[nmID].length === 0) {
      const product = uniqueProducts.value.find((p) => p.ni === nmID)
      if (product) {
        if (props.resolveSizes) {
          // Используем resolveSizes, если передан
          const sizes = await Promise.resolve(props.resolveSizes(product))
          sizesByNmId.value[nmID] = sizes
        } else {
          // Используем размеры из allSizesByNmId (собранные из productCards)
          sizesByNmId.value[nmID] = allSizesByNmId.value[nmID] || []
        }
      }
    }

    // НЕ автозаполняем selectedSizes (оставляем пустым)
    if (!selectedSizesByNmId.value[nmID]) {
      selectedSizesByNmId.value[nmID] = []
    }
  } else {
    // Удаляем товар
    selectedNmIds.value = selectedNmIds.value.filter((id) => id !== nmID)
    // Удаляем размеры
    delete selectedSizesByNmId.value[nmID]
  }
}

// Обновление размеров для товара
const handleUpdateSizes = (payload: { nmID: number; sizes: string[] }) => {
  selectedSizesByNmId.value[payload.nmID] = payload.sizes
}

// Удаление товара из выбора
const handleRemoveSelected = (payload: { nmID: number }) => {
  handleToggleProduct({ nmID: payload.nmID, checked: false })
}

// Подтверждение выбора
const handleConfirm = () => {
  if (!canConfirm.value) {
    return
  }

  const payload = selectedProducts.value.map((product) => ({
    product,
    sizes: selectedSizesByNmId.value[product.ni] || [],
  }))

  emit('confirm', payload)
}

// Закрытие модалки
const handleClose = () => {
  // Сброс состояния
  selectedNmIds.value = []
  selectedSizesByNmId.value = {}
  searchQuery.value = props.initialSearch
  debouncedSearchText.value = props.initialSearch

  emit('close')
}

// Автофокус на поиск при открытии
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) {
      return
    }

    await nextTick()
    searchInput.value?.focus()
  }
)

// Сброс при закрытии
watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      selectedNmIds.value = []
      selectedSizesByNmId.value = {}
      searchQuery.value = props.initialSearch
      debouncedSearchText.value = props.initialSearch
    }
  }
)
</script>
