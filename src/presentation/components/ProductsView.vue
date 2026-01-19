<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Каталог товаров</h2>
      <button
        @click="syncProducts"
        :disabled="isSyncing"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw :class="{ 'animate-spin': isSyncing }" class="w-4 h-4" />
        {{ isSyncing ? 'Синхронизация...' : 'Синхронизировать с WB' }}
      </button>
    </div>

    <!-- Статистика -->
    <div v-if="products.length > 0" class="bg-white px-4 py-3 rounded-lg shadow">
      <p class="text-sm text-gray-600">
        Всего товаров в базе: <span class="font-semibold text-gray-900">{{ products.length }}</span>
      </p>
    </div>

    <!-- Состояние загрузки -->
    <div v-if="isSyncing" class="bg-white p-6 rounded-lg shadow">
      <div class="flex items-center justify-center py-12">
        <RefreshCw class="w-8 h-8 text-blue-600 animate-spin" />
        <span class="ml-3 text-gray-600">Синхронизация каталога товаров...</span>
      </div>
    </div>

    <!-- Сообщение об отсутствии данных -->
    <div
      v-else-if="!products || products.length === 0"
      class="bg-white p-6 rounded-lg shadow text-center"
    >
      <p class="text-gray-600 mb-4">Нет товаров в базе данных</p>
      <p class="text-sm text-gray-500">Нажмите "Синхронизировать с WB" для загрузки каталога</p>
    </div>

    <!-- Список товаров -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <div class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 xl:grid-cols-12 gap-2 p-3">
        <div
          v-for="product in products"
          :key="product.nmId"
          class="border border-gray-200 rounded overflow-hidden hover:shadow-md transition-shadow"
        >
          <!-- Фото товара -->
          <div class="aspect-square bg-gray-100 flex items-center justify-center">
            <img
              v-if="product.photo"
              :src="product.photo"
              :alt="product.title || 'Товар'"
              class="w-full h-full object-cover"
              @error="handleImageError"
            />
            <div v-else class="text-gray-400 text-lg">📦</div>
          </div>

          <!-- Информация о товаре -->
          <div class="p-1.5">
            <h3 class="font-semibold text-gray-900 mb-1 line-clamp-2 text-xs leading-tight" :title="product.title">
              {{ product.title || 'Без названия' }}
            </h3>
            
            <div class="space-y-0.5 text-xs text-gray-600">
              <div v-if="product.vendorCode" class="truncate">
                <span class="font-medium">А:</span> {{ product.vendorCode }}
              </div>
              <div class="truncate">
                <span class="font-medium">ID:</span> {{ product.nmId }}
              </div>
              <div v-if="product.sizes && product.sizes.length > 0" class="truncate">
                <span class="font-medium">Р:</span> {{ product.sizes.length }}
              </div>
            </div>

            <!-- Редактирование веса -->
            <div class="mt-1.5 pt-1.5 border-t border-gray-100">
              <div class="flex items-center gap-1">
                <label class="text-xs font-medium text-gray-700">Вес (кг):</label>
                <input
                  :value="product.weight ? (product.weight > 1000 ? product.weight / 1000 : product.weight).toFixed(3) : ''"
                  @blur="updateProductWeight(product, ($event.target as HTMLInputElement).value)"
                  @keyup.enter="updateProductWeight(product, ($event.target as HTMLInputElement).value)"
                  type="number"
                  min="0"
                  step="0.001"
                  class="flex-1 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import { db } from '../../db/db'
import type { IProductCard } from '../../types/db'
import { toastService } from '../services/ToastService'

const store = useAnalyticsStore()

// Преобразуем productCards в формат для отображения
interface ProductDisplay {
  nmId: number
  title: string
  photo: string | null
  vendorCode: string
  sizes: string[]
  weight: number | null
}

const products = computed<ProductDisplay[]>(() => {
  // Группируем productCards по nmId (артикулу WB)
  const productMap = new Map<number, ProductDisplay>()
  
  for (const card of store.productCards) {
    if (!productMap.has(card.ni)) {
      productMap.set(card.ni, {
        nmId: card.ni,
        title: card.title || '',
        photo: card.img || null,
        vendorCode: card.sa || '',
        sizes: [],
        weight: card.weight || null,
      })
    }
    
    // Добавляем размер в список размеров
    const product = productMap.get(card.ni)!
    if (card.sz && !product.sizes.includes(card.sz)) {
      product.sizes.push(card.sz)
    }
    
    // Обновляем фото, если оно есть
    if (card.img && !product.photo) {
      product.photo = card.img
    }
    
    // Обновляем вес, если он есть (берем максимальный из всех размеров)
    if (card.weight) {
      // Если вес указан в граммах (больше 1000), конвертируем в кг
      const weightInKg = card.weight > 1000 ? card.weight / 1000 : card.weight
      if (!product.weight || weightInKg > product.weight) {
        product.weight = weightInKg
      }
    }
  }
  
  return Array.from(productMap.values())
})

const isSyncing = ref(false)

const loadProducts = async () => {
  // Данные уже загружены в store через loadAllDataFromDb
  // Просто ждем, пока store будет готов
  if (!store.isReady) {
    await new Promise(resolve => {
      const unwatch = store.$subscribe(() => {
        if (store.isReady) {
          unwatch()
          resolve(undefined)
        }
      })
    })
  }
}

const syncProducts = async () => {
  if (isSyncing.value) return

  isSyncing.value = true
  try {
    // Перезагружаем данные из БД
    await store.loadAllDataFromDb()
    toastService.success('Каталог товаров обновлен')
  } catch (error) {
    console.error('Ошибка при синхронизации товаров:', error)
    toastService.error('Ошибка при синхронизации товаров')
  } finally {
    isSyncing.value = false
  }
}

const updateProductWeight = async (product: ProductDisplay, weightValue: string) => {
  const weightInput = parseFloat(weightValue) || 0
  if (weightInput < 0) return

  try {
    // Обновляем вес во всех карточках товара с этим nmId
    const cards = store.productCards.filter(c => c.ni === product.nmId)
    
    // Вес всегда сохраняем в кг
    const weightInKg = weightInput
    
    for (const card of cards) {
      const updatedCard = {
        ...card,
        weight: weightInKg,
      }
      await db.product_cards.put(updatedCard)
    }
    
    // Обновляем store
    await store.loadAllDataFromDb()
    
    toastService.success('Вес товара обновлен')
  } catch (error) {
    console.error('Ошибка при обновлении веса товара:', error)
    toastService.error('Ошибка при сохранении веса товара')
  }
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  if (img.parentElement) {
    const placeholder = document.createElement('div')
    placeholder.className = 'text-gray-400 text-4xl'
    placeholder.textContent = '📦'
    img.parentElement.appendChild(placeholder)
  }
}

onMounted(() => {
  loadProducts()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
