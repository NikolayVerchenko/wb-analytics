<template>
  <div class="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between z-10">
    <button
      type="button"
      @click="$emit('cancel')"
      class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
    >
      Отмена
    </button>

    <div class="flex flex-col items-end">
      <button
        type="button"
        @click="$emit('confirm')"
        :disabled="!canConfirm"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {{ confirmLabel }}
      </button>
      <span v-if="readyInfo" class="text-xs text-gray-500 mt-1">
        {{ readyInfo }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canConfirm: boolean
  confirmLabel: string
  readyInfo?: string // Опционально: "Готово: X/Y"
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

