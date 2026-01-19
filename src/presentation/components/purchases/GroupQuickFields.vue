<template>
  <div class="mt-4 pt-4 border-t border-slate-200">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label class="block text-xs text-gray-600 mb-1.5">Вес ед. (кг)</label>
        <input
          type="text"
          :value="getInputValue('weightPerUnit')"
          @input="handleInput('weightPerUnit', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('weightPerUnit')"
          placeholder="0.000"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          :class="{
            'border-amber-500': validationState?.warnings?.some((w) => w.includes('вес') || w.includes('Вес'))
          }"
        />
      </div>

      <div>
        <label class="block text-xs text-gray-600 mb-1.5">Цена CNY</label>
        <input
          type="text"
          :value="getInputValue('priceCNY')"
          @input="handleInput('priceCNY', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('priceCNY')"
          placeholder="0.0"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          :class="{
            'border-amber-500': validationState?.warnings?.some((w) => w.includes('Цена'))
          }"
        />
      </div>

      <div>
        <label class="block text-xs text-gray-600 mb-1.5">Лог. CNY</label>
        <input
          type="text"
          :value="getInputValue('logisticsCNY')"
          @input="handleInput('logisticsCNY', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('logisticsCNY')"
          placeholder="0.0"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-xs text-gray-600 mb-1.5">Фулф. ₽</label>
        <input
          type="text"
          :value="getInputValue('fulfillmentRUB')"
          @input="handleInput('fulfillmentRUB', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('fulfillmentRUB')"
          placeholder="0.0"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-xs text-gray-600 mb-1.5">Упак. ₽</label>
        <input
          type="text"
          :value="getInputValue('packagingRUB')"
          @input="handleInput('packagingRUB', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('packagingRUB')"
          placeholder="0.0"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-xs text-gray-600 mb-1.5">КИЗ ₽</label>
        <input
          type="text"
          :value="getInputValue('kizRUB')"
          @input="handleInput('kizRUB', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('kizRUB')"
          placeholder="0.0"
          class="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>

    <div class="mt-4">
      <button
        type="button"
        @click="handleApplyToAll"
        class="px-4 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        Применить ко всем размерам
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { GroupedPurchase } from '../../../core/domain/purchases/types'
import type { IPurchaseItem } from '../../../types/db'

const props = defineProps<{
  group: GroupedPurchase
  getGroupValue: (nmID: number, field: keyof IPurchaseItem) => number
  validationState?: {
    errors: string[]
    warnings: string[]
  }
}>()

const emit = defineEmits<{
  'update-group-field': [nmID: number, field: keyof IPurchaseItem, value: number]
  'apply-to-all': [nmID: number, field: keyof IPurchaseItem, value: number]
}>()

// Локальное состояние для полей ввода (строковые значения)
const inputValues = ref<Record<string, string>>({})

// Получить значение для отображения (приоритет локальному значению)
function getInputValue(field: keyof IPurchaseItem): string {
  const key = `${props.group.nmID}-${field}`
  if (inputValues.value[key] !== undefined) {
    return inputValues.value[key]
  }
  const value = props.getGroupValue(props.group.nmID, field)
  const result = value > 0 ? value.toString() : ''
  return result
}

// Обработка ввода (сохраняем строку локально)
function handleInput(field: keyof IPurchaseItem, value: string) {
  const key = `${props.group.nmID}-${field}`
  
  // Разрешаем только числа, точку и минус в начале
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
    emit('update-group-field', props.group.nmID, field, numValue)
  }
}

// Обработка потери фокуса (преобразуем в число)
function handleBlur(field: keyof IPurchaseItem) {
  const key = `${props.group.nmID}-${field}`
  const strValue = inputValues.value[key] || ''
  const numValue = parseFloat(strValue)
  
  if (strValue === '' || strValue === '-' || isNaN(numValue)) {
    // Очищаем невалидное значение
    delete inputValues.value[key]
    emit('update-group-field', props.group.nmID, field, 0)
  } else {
    // Нормализуем до одного знака после запятой (до десятых) и обновляем
    const normalizedValue = Math.round(numValue * 10) / 10
    emit('update-group-field', props.group.nmID, field, normalizedValue)
    // Сохраняем нормализованное значение локально для отображения (формат с одним знаком после запятой)
    inputValues.value[key] = normalizedValue.toFixed(1)
  }
}

// Локальное состояние сбрасывается при потере фокуса, поэтому не нужно watch

function handleApplyToAll() {
  const fields: Array<keyof IPurchaseItem> = [
    'priceCNY',
    'weightPerUnit',
    'logisticsCNY',
    'fulfillmentRUB',
    'packagingRUB',
    'kizRUB'
  ]

  // Для каждого поля получаем значение (приоритет локальному значению)
  for (const field of fields) {
    const key = `${props.group.nmID}-${field}`
    const localValueStr = inputValues.value[key]
    
    let valueToApply: number
    
    // Проверяем локальное значение в первую очередь
    if (localValueStr !== undefined && localValueStr !== '' && localValueStr !== '-') {
      const parsed = parseFloat(localValueStr)
      if (!isNaN(parsed)) {
        valueToApply = parsed
      } else {
        // Локальное значение невалидно, используем значение из пропсов
        valueToApply = props.getGroupValue(props.group.nmID, field)
      }
    } else {
      // Нет локального значения, используем значение из пропсов
      valueToApply = props.getGroupValue(props.group.nmID, field)
    }
    
    // Применяем значение ко всем размерам (даже если оно 0)
    emit('apply-to-all', props.group.nmID, field, valueToApply)
    
    // Очищаем локальное значение для этого поля
    delete inputValues.value[key]
  }
}
</script>

