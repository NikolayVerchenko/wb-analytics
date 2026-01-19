<template>
  <div
    class="border rounded-xl p-4 transition-all cursor-pointer bg-white relative"
    :class="{
      'border-blue-500 bg-blue-50 shadow-lg': checked,
      'border-gray-200 hover:border-blue-500 hover:shadow-lg': !checked,
    }"
    @click="handleCardClick"
  >
    <!-- Checkbox in top-left corner -->
    <div class="absolute top-2 left-2 z-10" @click.stop="handleToggle">
      <input
        type="checkbox"
        :checked="checked"
        @change="handleToggle"
        class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
      />
    </div>

    <!-- Photo and Info -->
    <div class="flex items-start gap-4">
      <!-- Photo -->
      <div class="flex-shrink-0 mt-1">
        <img
          v-if="product.img && !imageError"
          :src="product.img"
          :alt="product.title"
          class="w-[60px] h-[60px] object-cover rounded-lg"
          @error="imageError = true"
          loading="lazy"
        />
        <div
          v-else
          class="w-[60px] h-[60px] bg-gray-200 rounded-lg flex items-center justify-center"
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
        <div
          class="text-sm font-semibold text-gray-900 mb-1 line-clamp-2"
          :title="product.title"
        >
          {{ product.title || 'Без названия' }}
        </div>
        <div class="text-xs text-gray-500 mb-2">
          <div>nmID: {{ product.ni }}</div>
        </div>
        <div v-if="product.sa" class="flex items-center gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {{ product.sa }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IProductCard } from '../../../types/db'

const props = defineProps<{
  product: IProductCard
  checked: boolean
}>()

const emit = defineEmits<{
  toggle: [payload: { nmID: number; checked: boolean }]
}>()

const imageError = ref(false)

const handleToggle = () => {
  emit('toggle', { nmID: props.product.ni, checked: !props.checked })
}

const handleCardClick = () => {
  emit('toggle', { nmID: props.product.ni, checked: !props.checked })
}
</script>

