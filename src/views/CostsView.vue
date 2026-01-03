<template>
  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Управление себестоимостью и налогами</h1>
      <p class="text-gray-600">Установите себестоимость и налоговую ставку для каждого товара</p>
    </div>

    <!-- Глобальная настройка налоговой ставки -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Налоговая ставка по умолчанию (%)
      </label>
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        :value="defaultTaxRate"
        @change="saveDefaultTaxRate"
        class="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        placeholder="0.0"
      />
      <p class="mt-2 text-sm text-gray-500">Эта ставка будет использоваться по умолчанию для новых товаров</p>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Загрузка товаров...</p>
    </div>

    <!-- Список товаров -->
    <div v-else-if="products.length > 0" class="bg-white rounded-lg shadow">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Фото
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Артикул WB
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Себестоимость единицы (₽)
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Налоговая ставка (%)
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="product in products" :key="product.ni" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <img
                  v-if="product.img"
                  :src="product.img"
                  :alt="product.title"
                  class="h-16 w-12 object-contain rounded"
                  @error="handleImageError"
                />
                <div v-else class="h-16 w-12 bg-gray-200 rounded flex items-center justify-center">
                  <span class="text-gray-400 text-xs">Нет фото</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ product.ni }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-900">
                <div class="font-medium">{{ product.title || 'Без названия' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    :value="getCost(product.ni)"
                    @change="handleCostChange(product.ni, $event)"
                    @blur="saveUnitCost(product.ni)"
                    class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="0.00"
                  />
                  <span v-if="costSaving[product.ni]" class="ml-2 text-green-600 text-xs">
                    ✓
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    :value="getTaxRate(product.ni)"
                    @change="handleTaxRateChange(product.ni, $event)"
                    @blur="saveUnitCost(product.ni)"
                    class="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="0.0"
                  />
                  <span v-if="taxRateSaving[product.ni]" class="ml-2 text-green-600 text-xs">
                    ✓
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else class="text-center py-12 bg-white rounded-lg shadow">
      <p class="text-gray-600">Товары не найдены. Загрузите карточки товаров через синхронизацию.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db } from '../db/db'
import type { IProductCard, IUnitCost } from '../types/db'

const loading = ref(true)
const products = ref<IProductCard[]>([])
const unitCosts = ref<Map<number, IUnitCost>>(new Map())
const defaultTaxRate = ref<number>(0)
const costSaving = ref<Map<number, boolean>>(new Map())
const taxRateSaving = ref<Map<number, boolean>>(new Map())

// Загрузка глобальной налоговой ставки
const loadDefaultTaxRate = async () => {
  try {
    const setting = await db.settings.get('default_tax_rate')
    if (setting) {
      defaultTaxRate.value = Number(setting.value) || 0
    }
  } catch (error) {
    console.error('Ошибка при загрузке налоговой ставки по умолчанию:', error)
  }
}

// Сохранение глобальной налоговой ставки
const saveDefaultTaxRate = async (event: Event) => {
  try {
    const target = event.target as HTMLInputElement
    const value = Number(target.value) || 0
    defaultTaxRate.value = value
    await db.settings.put({ key: 'default_tax_rate', value: String(value) })
    console.log(`[CostsView] Налоговая ставка по умолчанию сохранена: ${value}%`)
  } catch (error) {
    console.error('Ошибка при сохранении налоговой ставки по умолчанию:', error)
  }
}

// Загрузка уникальных товаров из product_cards
const loadProducts = async () => {
  try {
    loading.value = true
    
    // Получаем все карточки
    const allCards = await db.product_cards.toArray()
    
    // Группируем по ni (артикул WB), берем первую запись каждого артикула
    const uniqueProductsMap = new Map<number, IProductCard>()
    for (const card of allCards) {
      if (!uniqueProductsMap.has(card.ni)) {
        uniqueProductsMap.set(card.ni, card)
      }
    }
    
    // Преобразуем в массив и сортируем по артикулу
    products.value = Array.from(uniqueProductsMap.values()).sort((a, b) => a.ni - b.ni)
    
    // Загружаем себестоимость и налоговые ставки
    await loadUnitCosts()
  } catch (error) {
    console.error('Ошибка при загрузке товаров:', error)
  } finally {
    loading.value = false
  }
}

// Загрузка себестоимости и налоговых ставок из БД
const loadUnitCosts = async () => {
  try {
    const costs = await db.unit_costs.toArray()
    unitCosts.value = new Map(costs.map(c => [c.ni, c]))
  } catch (error) {
    console.error('Ошибка при загрузке себестоимости:', error)
  }
}

// Получить себестоимость для артикула
const getCost = (ni: number): number => {
  return unitCosts.value.get(ni)?.cost || 0
}

// Получить налоговую ставку для артикула (или значение по умолчанию)
const getTaxRate = (ni: number): number => {
  const unitCost = unitCosts.value.get(ni)
  if (unitCost && unitCost.taxRate !== undefined) {
    return unitCost.taxRate
  }
  return defaultTaxRate.value
}

// Обработка изменения себестоимости
const handleCostChange = (ni: number, event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value) || 0
  
  const existing = unitCosts.value.get(ni)
  if (existing) {
    existing.cost = value
  } else {
    unitCosts.value.set(ni, {
      ni,
      cost: value,
      taxRate: defaultTaxRate.value,
    })
  }
}

// Обработка изменения налоговой ставки
const handleTaxRateChange = (ni: number, event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value) || 0
  
  const existing = unitCosts.value.get(ni)
  if (existing) {
    existing.taxRate = value
  } else {
    unitCosts.value.set(ni, {
      ni,
      cost: getCost(ni),
      taxRate: value,
    })
  }
}

// Сохранение себестоимости и налоговой ставки в БД
const saveUnitCost = async (ni: number) => {
  try {
    const unitCost = unitCosts.value.get(ni)
    
    if (unitCost && (unitCost.cost > 0 || unitCost.taxRate > 0)) {
      // Если себестоимость или налоговая ставка заданы, сохраняем
      await db.unit_costs.put({
        ni: unitCost.ni,
        cost: unitCost.cost || 0,
        taxRate: unitCost.taxRate !== undefined ? unitCost.taxRate : defaultTaxRate.value,
      })
      console.log(`[CostsView] Данные сохранены: ni=${ni}, cost=${unitCost.cost}, taxRate=${unitCost.taxRate}`)
      
      // Показываем индикатор сохранения
      if (unitCost.cost > 0) {
        costSaving.value.set(ni, true)
        setTimeout(() => {
          costSaving.value.set(ni, false)
        }, 1000)
      }
      if (unitCost.taxRate > 0) {
        taxRateSaving.value.set(ni, true)
        setTimeout(() => {
          taxRateSaving.value.set(ni, false)
        }, 1000)
      }
    } else if (unitCost && unitCost.cost === 0 && unitCost.taxRate === 0) {
      // Если оба значения = 0, удаляем запись
      await db.unit_costs.delete(ni)
      console.log(`[CostsView] Данные удалены: ni=${ni}`)
    }
  } catch (error) {
    console.error(`Ошибка при сохранении данных для ni=${ni}:`, error)
  }
}

// Обработка ошибки загрузки изображения
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

onMounted(async () => {
  await loadDefaultTaxRate()
  await loadProducts()
})
</script>
