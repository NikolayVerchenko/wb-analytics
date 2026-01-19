<template>
  <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-12">
    <div class="flex flex-col items-center justify-center text-center">
      <svg
        class="w-16 h-16 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Нет закупок</h3>
      <p class="text-sm text-gray-500 mb-6">
        Начните создавать закупки из Китая, чтобы отслеживать ваши заказы
      </p>
      <router-link
        to="/purchases/new"
        class="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
      >
        <svg
          class="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Новая закупка
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
