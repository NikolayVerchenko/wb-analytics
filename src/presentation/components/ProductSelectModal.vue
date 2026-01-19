<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="handleClose"
      @keydown.esc="handleClose"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Выбор товара</h3>
            <button
              @click="handleClose"
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

          <!-- Search -->
          <div class="p-4 border-b border-gray-200">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по названию, артикулу WB или артикулу продавца..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keydown.esc.stop="handleClose"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="filteredProducts.length === 0" class="text-center text-gray-500 py-8">
              Товары не найдены
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="product in filteredProducts"
                :key="product.ni"
                @click="handleProductClick(product)"
                class="border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                :class="{
                  'border-blue-500 bg-blue-50': isProductSelected(product.ni),
                }"
              >
                <div class="flex items-start gap-3">
                  <!-- Photo -->
                  <div class="flex-shrink-0">
                    <img
                      v-if="product.img"
                      :src="product.img"
                      :alt="product.title"
                      class="w-16 h-20 object-cover rounded"
                      @error="handleImageError"
                    />
                    <div
                      v-else
                      class="w-16 h-20 bg-gray-200 rounded flex items-center justify-center"
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
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-900 truncate" :title="product.title">
                          {{ product.title || 'Без названия' }}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                          <div>WB: {{ product.ni }}</div>
                          <div v-if="product.sa">Артикул: {{ product.sa }}</div>
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
                    <div class="mt-2">
                      <span class="text-xs text-gray-400">
                        Размеров: {{ getProductSizes(product.ni).length }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
            <button
              @click="handleClose"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
  selectedNmIds?: number[] // Список уже выбранных nmID
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

// Группируем productCards по nmID (артикулу WB)
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

    // Берем максимальный вес из всех размеров
    if (card.weight && (!product.weight || card.weight > product.weight)) {
      product.weight = card.weight > 1000 ? card.weight / 1000 : card.weight
    }
  }

  return Array.from(productMap.values())
})

// Фильтрация товаров по поисковому запросу
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

// Получение размеров товара
const getProductSizes = (nmId: number): string[] => {
  const product = products.value.find(p => p.ni === nmId)
  return product?.sizes || []
}

// Обработка клика на товар
const handleProductClick = (product: ProductWithSizes) => {
  // Передаем товар и все его размеры
  emit('select', product, product.sizes)
}

// Обработка закрытия
const handleClose = () => {
  emit('close')
}

// Обработка ошибки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Сброс поиска при закрытии
watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      searchQuery.value = ''
    }
  }
)
</script>

