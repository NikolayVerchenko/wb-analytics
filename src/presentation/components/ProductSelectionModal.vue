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
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            class="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 class="text-xl font-semibold text-gray-900">Выбор товара</h3>
                <p class="text-sm text-gray-500 mt-1">Выберите товар и его размеры для закупки</p>
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

            <!-- Search -->
            <div class="p-6 border-b border-gray-200">
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
                  placeholder="Поиск по названию, артикулу WB или артикулу продавца..."
                  class="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  @keydown.esc.stop="handleClose"
                />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6">
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
              <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="product in filteredProducts"
                  :key="product.ni"
                  class="border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-white"
                  :class="{
                    'border-blue-500 bg-blue-50/50': isProductSelected(product.ni),
                  }"
                >
                  <!-- Photo and Info -->
                  <div class="flex items-start gap-4 mb-4">
                    <img
                      v-if="product.img"
                      :src="product.img"
                      :alt="product.title"
                      class="w-15 h-15 object-cover rounded-lg flex-shrink-0"
                      @error="handleImageError"
                    />
                    <div
                      v-else
                      class="w-[60px] h-[60px] bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <svg
                        class="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                          <div
                            class="text-sm font-semibold text-gray-900 truncate mb-1"
                            :title="product.title"
                          >
                            {{ product.title || 'Без названия' }}
                          </div>
                          <div class="text-xs text-gray-500 space-y-0.5">
                            <div>WB: {{ product.ni }}</div>
                            <div v-if="product.sa">Арт: {{ product.sa }}</div>
                          </div>
                        </div>
                        <!-- Selected indicator -->
                        <div v-if="isProductSelected(product.ni)" class="flex-shrink-0">
                          <svg
                            class="w-5 h-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Size Selection Button -->
                  <button
                    @click.stop="openSizeSelector(product)"
                    class="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Выбрать размеры ({{ product.sizes.length }})
                  </button>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                @click="handleClose"
                class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>

        <!-- Size Selector Modal -->
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="selectedProductForSizes"
            class="fixed inset-0 z-[60] flex items-center justify-center p-4"
            @click.self="closeSizeSelector"
          >
            <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="closeSizeSelector"></div>
            <div
              class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full"
              @click.stop
            >
              <div class="p-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-lg font-semibold text-gray-900">Выбор размеров</h4>
                    <p class="text-sm text-gray-500 mt-1">
                      {{ selectedProductForSizes.title || `Артикул ${selectedProductForSizes.ni}` }}
                    </p>
                  </div>
                  <button
                    @click="closeSizeSelector"
                    class="text-gray-400 hover:text-gray-600 transition-colors"
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
              </div>
              <div class="p-6">
                <div class="space-y-2 max-h-96 overflow-y-auto">
                  <label
                    v-for="size in selectedProductForSizes.sizes"
                    :key="size"
                    class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    :class="{
                      'border-blue-500 bg-blue-50': selectedSizes.has(size),
                    }"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSizes.has(size)"
                      @change="toggleSize(size)"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="ml-3 text-sm font-medium text-gray-900">{{ size }}</span>
                  </label>
                </div>
              </div>
              <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  @click="closeSizeSelector"
                  class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Отмена
                </button>
                <button
                  @click="confirmSizeSelection"
                  :disabled="selectedSizes.size === 0"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Добавить ({{ selectedSizes.size }})
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import type { IProductCard } from '../../types/db'

interface ProductWithSizes {
  ni: number
  title: string
  img: string | null
  sa: string
  sizes: string[]
  weight: number | null
}

interface Props {
  isOpen: boolean
  selectedNmIds?: number[]
}

interface Emits {
  (e: 'close'): void
  (e: 'select', product: ProductWithSizes, sizes: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedNmIds: () => [],
})

const emit = defineEmits<Emits>()

const store = useAnalyticsStore()
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const selectedProductForSizes = ref<ProductWithSizes | null>(null)
const selectedSizes = ref<Set<string>>(new Set())

// Группируем productCards по nmID
const products = computed<ProductWithSizes[]>(() => {
  const productMap = new Map<number, ProductWithSizes>()

  for (const card of store.productCards) {
    if (!productMap.has(card.ni)) {
      productMap.set(card.ni, {
        ni: card.ni,
        title: card.title || '',
        img: card.img || null,
        sa: card.sa || '',
        sizes: [],
        weight: card.weight || null,
      })
    }

    const product = productMap.get(card.ni)!
    if (card.sz && !product.sizes.includes(card.sz)) {
      product.sizes.push(card.sz)
    }

    if (card.img && !product.img) {
      product.img = card.img
    }

    if (card.weight && (!product.weight || card.weight > product.weight)) {
      product.weight = card.weight > 1000 ? card.weight / 1000 : card.weight
    }
  }

  return Array.from(productMap.values())
})

// Фильтрация товаров
const filteredProducts = computed(() => {
  if (!searchQuery.value.trim()) {
    return products.value
  }

  const query = searchQuery.value.toLowerCase().trim()

  return products.value.filter(product => {
    const titleMatch = product.title.toLowerCase().includes(query)
    const nmIdMatch = product.ni.toString().includes(query)
    const saMatch = product.sa.toLowerCase().includes(query)

    return titleMatch || nmIdMatch || saMatch
  })
})

// Проверка, выбран ли товар
const isProductSelected = (nmId: number): boolean => {
  return props.selectedNmIds.includes(nmId)
}

// Открытие селектора размеров
const openSizeSelector = (product: ProductWithSizes) => {
  selectedProductForSizes.value = product
  selectedSizes.value = new Set(product.sizes) // По умолчанию выбираем все размеры
}

// Закрытие селектора размеров
const closeSizeSelector = () => {
  selectedProductForSizes.value = null
  selectedSizes.value = new Set()
}

// Переключение размера
const toggleSize = (size: string) => {
  if (selectedSizes.value.has(size)) {
    selectedSizes.value.delete(size)
  } else {
    selectedSizes.value.add(size)
  }
}

// Подтверждение выбора размеров
const confirmSizeSelection = () => {
  if (!selectedProductForSizes.value || selectedSizes.value.size === 0) {
    return
  }

  emit('select', selectedProductForSizes.value, Array.from(selectedSizes.value))
  closeSizeSelector()
}

// Закрытие модалки
const handleClose = () => {
  emit('close')
}

// Обработка ошибки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Автофокус на поиск при открытии
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) {
      searchQuery.value = ''
      return
    }

    await nextTick()
    searchInput.value?.focus()
  }
)
</script>


