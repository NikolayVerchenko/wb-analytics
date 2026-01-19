<template>
  <div class="overflow-x-auto -mx-2 px-2">
    <table class="w-full border-collapse min-w-full">
      <thead>
        <tr class="border-b border-slate-200 bg-slate-50">
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Размер</th>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Кол-во</th>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Цена CNY</th>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Себест. ₽</th>
          <th class="px-3 py-2 text-right text-xs font-semibold text-gray-700"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="`${item.nmID}-${item.techSize}`"
          class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
        >
          <td class="px-3 py-2 text-xs font-medium text-gray-700">
            {{ item.techSize }}
          </td>
          <td class="px-3 py-2">
            <input
              type="text"
              :value="getInputValue(item, 'quantity')"
              @input="handleInput(item.nmID, item.techSize, 'quantity', ($event.target as HTMLInputElement).value)"
              @blur="handleBlur(item.nmID, item.techSize, 'quantity')"
              placeholder="1"
              class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              :class="{
                'border-red-500': item.quantity <= 0
              }"
            />
          </td>
          <td class="px-3 py-2">
            <input
              type="text"
              :value="getInputValue(item, 'priceCNY')"
              @input="handleInput(item.nmID, item.techSize, 'priceCNY', ($event.target as HTMLInputElement).value)"
              @blur="handleBlur(item.nmID, item.techSize, 'priceCNY')"
              placeholder="0.0"
              class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </td>
          <td class="px-3 py-2 text-xs font-medium text-gray-900">
            {{ calculateItemCost(item).costPerUnit.toFixed(2) }}
          </td>
          <td class="px-3 py-2 text-right">
            <button
              type="button"
              @click="$emit('remove-item', item.nmID, item.techSize)"
              class="text-red-600 hover:text-red-800 transition-colors p-1"
              title="Удалить размер"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IPurchaseItem } from '../../../types/db'
import type { ItemCostCalculation } from '../../../core/domain/purchases/types'

const props = defineProps<{
  items: IPurchaseItem[]
  calculateItemCost: (item: IPurchaseItem) => ItemCostCalculation
}>()

const emit = defineEmits<{
  'remove-item': [nmID: number, techSize: string]
  'update-variant-field': [nmID: number, techSize: string, field: 'quantity' | 'priceCNY', value: number]
}>()

// Локальное состояние для полей ввода (строковые значения)
const inputValues = ref<Record<string, string>>({})

// Получить значение для отображения (приоритет локальному значению)
function getInputValue(item: IPurchaseItem, field: 'quantity' | 'priceCNY'): string {
  const key = `${item.nmID}-${item.techSize}-${field}`
  if (inputValues.value[key] !== undefined) {
    return inputValues.value[key]
  }
  const value = item[field]
  return value > 0 ? value.toString() : ''
}

// Обработка ввода (сохраняем строку локально)
function handleInput(nmID: number, techSize: string, field: 'quantity' | 'priceCNY', value: string) {
  const key = `${nmID}-${techSize}-${field}`
  
  if (field === 'quantity') {
    // Для количества разрешаем только целые числа
    const cleaned = value.replace(/[^\d]/g, '')
    inputValues.value[key] = cleaned
    
    // Если значение валидно, сразу обновляем
    const numValue = parseInt(cleaned, 10)
    if (!isNaN(numValue) && cleaned !== '') {
      emit('update-variant-field', nmID, techSize, field, numValue)
    }
  } else {
    // Для цены разрешаем числа, точку и минус в начале
    let cleaned = value.replace(/[^\d.-]/g, '').replace(/(?!^)-/g, '').replace(/\./g, (match, offset) => {
      // Разрешаем только одну точку
      return value.indexOf('.') === offset ? match : ''
    })
    
    // Ограничиваем до одного знака после запятой (до десятых)
    const dotIndex = cleaned.indexOf('.')
    if (dotIndex !== -1 && cleaned.length > dotIndex + 2) {
      cleaned = cleaned.substring(0, dotIndex + 2)
    }
    
    inputValues.value[key] = cleaned
    
    // Если значение валидно, сразу обновляем
    const numValue = parseFloat(cleaned)
    if (!isNaN(numValue) && cleaned !== '' && cleaned !== '-') {
      emit('update-variant-field', nmID, techSize, field, numValue)
    }
  }
}

// Обработка потери фокуса (преобразуем в число)
function handleBlur(nmID: number, techSize: string, field: 'quantity' | 'priceCNY') {
  const key = `${nmID}-${techSize}-${field}`
  const strValue = inputValues.value[key] || ''
  
  if (field === 'quantity') {
    const numValue = parseInt(strValue, 10)
    if (strValue === '' || isNaN(numValue) || numValue <= 0) {
      // Очищаем невалидное значение и устанавливаем 1 как минимум
      delete inputValues.value[key]
      emit('update-variant-field', nmID, techSize, field, 1)
    } else {
      // Нормализуем и обновляем
      emit('update-variant-field', nmID, techSize, field, numValue)
      // Сохраняем нормализованное значение локально для отображения
      inputValues.value[key] = numValue.toString()
    }
  } else {
    const numValue = parseFloat(strValue)
    if (strValue === '' || strValue === '-' || isNaN(numValue)) {
      // Очищаем невалидное значение
      delete inputValues.value[key]
      emit('update-variant-field', nmID, techSize, field, 0)
    } else {
      // Нормализуем до одного знака после запятой (до десятых) и обновляем
      const normalizedValue = Math.round(numValue * 10) / 10
      emit('update-variant-field', nmID, techSize, field, normalizedValue)
      // Сохраняем нормализованное значение локально для отображения (формат с одним знаком после запятой)
      inputValues.value[key] = normalizedValue.toFixed(1)
    }
  }
}
</script>

