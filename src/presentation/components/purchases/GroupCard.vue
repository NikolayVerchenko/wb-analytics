<template>
  <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
    <!-- Header -->
    <div class="flex items-start gap-3 mb-4">
      <!-- Фото -->
      <div class="flex-shrink-0">
        <img
          v-if="imageUrl && !imageError"
          :src="imageUrl"
          :alt="group.title"
          class="w-16 h-20 object-cover rounded"
          loading="lazy"
          @error="imageError = true"
          @load="imageError = false"
        />
        <div
          v-else
          class="w-16 h-20 bg-gray-200 rounded flex items-center justify-center"
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
      </div>

      <!-- Информация о товаре -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 truncate" :title="group.title">
              {{ group.title }}
            </h4>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-600">
              <span>nmID: <span class="font-medium">{{ group.nmID }}</span></span>
              <span>Vendor: <span class="font-medium">{{ group.vendorCode }}</span></span>
              <span v-if="group.color">Цвет: <span class="font-medium">{{ group.color }}</span></span>
            </div>
          </div>

          <!-- Бейджи ошибок/предупреждений -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <span
              v-if="validationState?.warnings?.length"
              class="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded"
              title="Предупреждения"
            >
              ⚠️ {{ validationState.warnings.length }}
            </span>
            <span
              v-if="validationState?.errors?.length"
              class="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded"
              title="Ошибки"
            >
              🔴 {{ validationState.errors.length }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Размеров: <span class="font-medium text-gray-700">{{ group.items.length }}</span></span>
          <span>Кол-во: <span class="font-medium text-gray-700">{{ group.totalQuantity }}</span></span>
        </div>
      </div>

      <!-- Кнопка удаления группы -->
      <button
        type="button"
        @click="$emit('remove-group', group.nmID)"
        class="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors p-1"
        title="Удалить весь артикул"
      >
        <svg
          class="w-5 h-5"
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
    </div>

    <!-- Quick Fields -->
    <GroupQuickFields
      :group="group"
      :get-group-value="getGroupValue"
      :validation-state="validationState"
      @update-group-field="(nmID, field, value) => $emit('update-group-field', nmID, field, value)"
      @apply-to-all="(nmID, field, value) => $emit('apply-to-all', nmID, field, value)"
    />

    <!-- Variants Accordion -->
    <VariantsAccordion
      :group="group"
      :calculate-item-cost="calculateItemCost"
      @remove-item="(nmID, techSize) => $emit('remove-item', nmID, techSize)"
      @update-variant-field="(nmID, techSize, field, value) => $emit('update-variant-field', nmID, techSize, field, value)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { GroupedPurchase } from '../../../core/domain/purchases/types'
import type { IPurchaseItem } from '../../../types/db'
import type { ItemCostCalculation } from '../../../core/domain/purchases/types'
import GroupQuickFields from './GroupQuickFields.vue'
import VariantsAccordion from './VariantsAccordion.vue'

const props = defineProps<{
  group: GroupedPurchase
  getGroupValue: (nmID: number, field: keyof IPurchaseItem) => number
  calculateItemCost: (item: IPurchaseItem) => ItemCostCalculation
  validationState?: {
    errors: string[]
    warnings: string[]
  }
}>()

defineEmits<{
  'remove-group': [nmID: number]
  'update-group-field': [nmID: number, field: keyof IPurchaseItem, value: number]
  'apply-to-all': [nmID: number, field: keyof IPurchaseItem, value: number]
  'remove-item': [nmID: number, techSize: string]
  'update-variant-field': [nmID: number, techSize: string, field: 'quantity' | 'priceCNY', value: number]
}>()

// Состояние ошибки загрузки изображения
const imageError = ref(false)

// Проверка валидности изображения
const hasValidImage = computed(() => {
  const img = props.group.img
  if (!img) return false
  const trimmed = typeof img === 'string' ? img.trim() : ''
  return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined'
})

// Получаем URL изображения с проверкой
const imageUrl = computed(() => {
  const img = props.group.img
  if (!img) return null
  const trimmed = typeof img === 'string' ? img.trim() : ''
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null
  
  // Если URL не начинается с http:// или https://, добавляем https://
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  // Если URL выглядит как путь без протокола, пробуем добавить https://
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  return trimmed
})

// Сбрасываем ошибку при изменении URL изображения
watch(() => props.group.img, () => {
  imageError.value = false
})
</script>

