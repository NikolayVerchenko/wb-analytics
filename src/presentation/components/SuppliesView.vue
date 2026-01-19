<template>
  <div class="space-y-6">
    <!-- Заголовок и кнопка синхронизации -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Поставки</h2>
      <button
        @click="syncSupplies"
        :disabled="isSyncing"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {{ isSyncing ? 'Синхронизация...' : 'Синхронизировать поставки' }}
      </button>
    </div>

    <!-- Таблица -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID Поставки
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата создания
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата приемки
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Товаров
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Итого шт.
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-for="supply in supplies" :key="supply.supplyID">
              <!-- Строка поставки -->
              <tr
                :data-supply-id="supply.supplyID"
                class="cursor-pointer hover:bg-gray-50 transition-colors"
                @click="toggleSupply(supply.supplyID)"
              >
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                  {{ supply.supplyID }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ formatDate(supply.createDate) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ supply.factDate ? formatDate(supply.factDate) : '—' }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <span
                    class="px-2 py-1 text-xs font-semibold rounded-full"
                    :class="getStatusClass(supply.factDate)"
                  >
                    {{ getStatusText(supply.factDate) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ supply.items.length }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ getTotalAcceptedQuantity(supply) }}
                </td>
              </tr>

              <!-- Раскрытая таблица с составом поставки -->
              <tr v-if="expandedSupplies.has(supply.supplyID)" class="bg-gray-50">
                <td colspan="7" class="px-4 py-4">
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Фото
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Артикул
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Размер
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Отгружено
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Принято
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Расхождение
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Себестоимость ед. (закуп)
                          </th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="(item, index) in supply.items" :key="index">
                          <td class="px-4 py-2">
                            <div class="flex items-center gap-3">
                              <img
                                :src="getProductImage(item.nmID, item.techSize)"
                                :alt="`Товар ${item.nmID}`"
                                class="w-[50px] h-[65px] object-cover rounded flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                @error="handleImageError"
                                v-if="getProductImage(item.nmID, item.techSize)"
                                :title="getProductTitle(item.nmID, item.techSize) || ''"
                              />
                              <div
                                v-else
                                class="w-[50px] h-[65px] bg-gray-200 rounded flex items-center justify-center flex-shrink-0"
                              >
                                <svg
                                  class="w-6 h-6 text-gray-400"
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
                                <div class="text-sm font-medium text-gray-900 truncate">
                                  {{ getProductTitle(item.nmID, item.techSize) || `Артикул ${item.nmID}` }}
                                </div>
                                <div class="text-xs text-gray-500">
                                  {{ getProductVendorCode(item.nmID, item.techSize) || item.nmID }}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td class="px-4 py-2 text-sm text-gray-600">
                            {{ item.techSize }}
                          </td>
                          <td class="px-4 py-2 text-sm text-gray-600">
                            {{ item.quantity }}
                          </td>
                          <td class="px-4 py-2 text-sm text-gray-600">
                            {{ item.acceptedQuantity ?? '—' }}
                          </td>
                          <td class="px-4 py-2 text-sm"
                              :class="getDifferenceClass(item.quantity - (item.acceptedQuantity || 0))">
                            {{ item.quantity - (item.acceptedQuantity || 0) }}
                          </td>
                          <td class="px-4 py-2">
                            <div class="flex items-center gap-2">
                              <input
                                type="number"
                                :value="item.cost || ''"
                                @focus="handleCostFocus(supply.supplyID, item.nmID, item.techSize, $event)"
                                @blur="handleCostBlur(supply.supplyID, item.nmID, item.techSize, $event)"
                                @click.stop
                                @mousedown.stop
                                step="0.01"
                                min="0"
                                :class="[
                                  'w-24 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                                  item.cost ? 'border-green-300 bg-green-50 font-medium' : 'border-gray-300'
                                ]"
                                placeholder="0.00"
                              />
                              <transition name="fade">
                                <svg
                                  v-if="getSavedIndicator(supply.supplyID, item.nmID, item.techSize)"
                                  class="w-5 h-5 text-green-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                              </transition>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>

            <!-- Пустое состояние -->
            <tr v-if="supplies.length === 0 && !isLoading">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Нет данных. Нажмите "Синхронизировать поставки" для загрузки.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAnalyticsStore } from '../../stores/analyticsStore'
import type { ISupply } from '../../types/db'
import { toastService } from '../services/ToastService'

const store = useAnalyticsStore()
const route = useRoute()

// Состояние
const supplies = ref<ISupply[]>([])
const expandedSupplies = ref<Set<number>>(new Set())
const isSyncing = ref(false)
const isLoading = ref(false)
// Map для отслеживания сохраненных полей: ключ = `${supplyID}_${nmID}_${techSize}`
const savedIndicators = ref<Map<string, boolean>>(new Map())

// Map для отслеживания исходных значений себестоимости при фокусе: ключ = `${supplyID}_${nmID}_${techSize}`
const originalCosts = ref<Map<string, number | undefined>>(new Map())

// Загрузка поставок
const loadSupplies = async () => {
  isLoading.value = true
  try {
    supplies.value = await store.getAllSupplies()
  } catch (error) {
    console.error('Ошибка при загрузке поставок:', error)
    toastService.error('Ошибка при загрузке поставок')
  } finally {
    isLoading.value = false
  }
}

// Синхронизация поставок
const syncSupplies = async () => {
  isSyncing.value = true
  try {
    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1) // Загружаем за последний год
    
    const dateFrom = oneYearAgo.toISOString().split('T')[0]
    const dateTo = now.toISOString().split('T')[0]
    
    const count = await store.loadSupplies(dateFrom, dateTo)
    toastService.success(`Загружено поставок: ${count}`)
    
    // Перезагружаем список
    await loadSupplies()
  } catch (error: any) {
    console.error('Ошибка при синхронизации поставок:', error)
    toastService.error(`Ошибка при синхронизации: ${error.message || 'Неизвестная ошибка'}`)
  } finally {
    isSyncing.value = false
  }
}

// Переключение раскрытия поставки
const toggleSupply = (supplyID: number) => {
  if (expandedSupplies.value.has(supplyID)) {
    expandedSupplies.value.delete(supplyID)
  } else {
    expandedSupplies.value.add(supplyID)
  }
}

// Получение фото товара
const getProductImage = (nmID: number, techSize: string): string | null => {
  const card = store.productCards.find(c => c.ni === nmID && c.sz === techSize)
  return card?.img || null
}

// Получение названия товара
const getProductTitle = (nmID: number, techSize: string): string | null => {
  const card = store.productCards.find(c => c.ni === nmID && c.sz === techSize)
  return card?.title || null
}

// Получение артикула продавца
const getProductVendorCode = (nmID: number, techSize: string): string | null => {
  const card = store.productCards.find(c => c.ni === nmID && c.sz === techSize)
  return card?.sa || null
}

// Обработка ошибки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Форматирование даты
const formatDate = (dateString: string): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// Получение текста статуса
const getStatusText = (factDate: string | null): string => {
  return factDate ? 'Принято' : 'Отгружено'
}

// Получение класса статуса
const getStatusClass = (factDate: string | null): string => {
  return factDate
    ? 'bg-green-100 text-green-800'
    : 'bg-yellow-100 text-yellow-800'
}

// Итоговое принятое количество
const getTotalAcceptedQuantity = (supply: ISupply): number => {
  return supply.items.reduce((sum, item) => sum + (item.acceptedQuantity || 0), 0)
}

// Класс для расхождения
const getDifferenceClass = (difference: number): string => {
  if (difference === 0) return 'text-green-600 font-semibold'
  if (difference > 0) return 'text-red-600 font-semibold'
  return 'text-gray-600'
}

// Обработка focus для запоминания исходного значения
const handleCostFocus = (supplyID: number, nmID: number, techSize: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const valueStr = target.value.trim()
  const originalValue = valueStr ? parseFloat(valueStr) : undefined
  const key = `${supplyID}_${nmID}_${techSize}`
  
  // Сохраняем исходное значение, если оно валидное
  if (originalValue !== undefined && !isNaN(originalValue) && isFinite(originalValue)) {
    originalCosts.value.set(key, originalValue)
  } else {
    // Получаем исходное значение из локального состояния
    const supplyIndex = supplies.value.findIndex(s => s.supplyID === supplyID)
    if (supplyIndex !== -1) {
      const item = supplies.value[supplyIndex].items.find(
        item => item.nmID === nmID && item.techSize === techSize
      )
      originalCosts.value.set(key, item?.cost)
    }
  }
}

// Обработка blur для сохранения себестоимости (только если значение изменилось)
const handleCostBlur = async (
  supplyID: number,
  nmID: number,
  techSize: string,
  event: Event
) => {
  const target = event.target as HTMLInputElement
  const valueStr = target.value.trim()
  let newCost: number | undefined = undefined
  
  if (valueStr) {
    const parsed = parseFloat(valueStr)
    if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
      newCost = parsed
    }
  }

  const key = `${supplyID}_${nmID}_${techSize}`
  const originalCost = originalCosts.value.get(key)
  
  // Сохраняем только если значение изменилось
  if (newCost !== originalCost) {
    console.log(`[SuppliesView] handleCostBlur: значение изменилось, supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}, было=${originalCost}, стало=${newCost}`)
  await saveItemCost(supplyID, nmID, techSize, newCost)
  } else {
    console.log(`[SuppliesView] handleCostBlur: значение не изменилось, сохранение пропущено, supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}`)
  }
  
  // Удаляем сохраненное исходное значение
  originalCosts.value.delete(key)
}

// Сохранение себестоимости товара в поставке
const saveItemCost = async (
  supplyID: number,
  nmID: number,
  techSize: string,
  newCost: number | undefined
) => {
  try {
    console.log(`[SuppliesView] saveItemCost: сохранение себестоимости supplyID=${supplyID}, nmID=${nmID}, techSize=${techSize}, cost=${newCost}`)
    
    await store.updateSupplyItemCost(supplyID, nmID, techSize, newCost)
    
    console.log(`[SuppliesView] saveItemCost: себестоимость успешно сохранена в БД`)

    // Обновляем локальный массив supplies, чтобы мгновенно отразить изменения
    const supplyIndex = supplies.value.findIndex(s => s.supplyID === supplyID)
    if (supplyIndex !== -1) {
      const itemIndex = supplies.value[supplyIndex].items.findIndex(
        item => item.nmID === nmID && item.techSize === techSize
      )
      if (itemIndex !== -1) {
        supplies.value[supplyIndex].items[itemIndex] = {
          ...supplies.value[supplyIndex].items[itemIndex],
          cost: newCost,
        }
        console.log(`[SuppliesView] saveItemCost: локальное состояние обновлено, новый cost=${supplies.value[supplyIndex].items[itemIndex].cost}`)
      } else {
        console.warn(`[SuppliesView] saveItemCost: товар не найден в локальном состоянии (nmID=${nmID}, techSize=${techSize})`)
      }
    } else {
      console.warn(`[SuppliesView] saveItemCost: поставка не найдена в локальном состоянии (supplyID=${supplyID})`)
    }

    // Показываем индикатор сохранения
    const indicatorKey = `${supplyID}_${nmID}_${techSize}`
    savedIndicators.value.set(indicatorKey, true)

    // Скрываем индикатор через 1 секунду
    setTimeout(() => {
      savedIndicators.value.delete(indicatorKey)
    }, 1000)
    
    toastService.success('Себестоимость сохранена')
  } catch (error) {
    console.error('[SuppliesView] Ошибка при обновлении себестоимости:', error)
    toastService.error('Ошибка при сохранении себестоимости')
  }
}

// Проверка, нужно ли показать индикатор сохранения
const getSavedIndicator = (
  supplyID: number,
  nmID: number,
  techSize: string
): boolean => {
  const indicatorKey = `${supplyID}_${nmID}_${techSize}`
  return savedIndicators.value.has(indicatorKey)
}

// Загрузка при монтировании
onMounted(() => {
  loadSupplies().then(() => {
    // Проверяем query параметр supplyId
    const supplyIdParam = route.query.supplyId
    if (supplyIdParam) {
      const supplyId = parseInt(String(supplyIdParam), 10)
      if (!isNaN(supplyId)) {
        nextTick(() => {
          expandAndScrollToSupply(supplyId)
        })
      }
    }
  })
})

// Наблюдаем за изменением query параметра
watch(() => route.query.supplyId, (newSupplyId) => {
  if (newSupplyId && supplies.value.length > 0) {
    const supplyId = parseInt(String(newSupplyId), 10)
    if (!isNaN(supplyId)) {
      nextTick(() => {
        expandAndScrollToSupply(supplyId)
      })
    }
  }
})

// Раскрывает поставку и прокручивает к ней
const expandAndScrollToSupply = (supplyID: number) => {
  // Раскрываем поставку
  if (!expandedSupplies.value.has(supplyID)) {
    expandedSupplies.value.add(supplyID)
  }
  
  // Прокручиваем к элементу
  nextTick(() => {
    const element = document.querySelector(`[data-supply-id="${supplyID}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

