<template>
  <div class="sticky bottom-0 z-40 bg-white border-t border-slate-200 shadow-lg">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-start">
      <button
        type="button"
        @click="handleBack"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors"
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
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Назад
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const handleBack = () => {
  if (router) {
    router.back()
  }
}
</script>

