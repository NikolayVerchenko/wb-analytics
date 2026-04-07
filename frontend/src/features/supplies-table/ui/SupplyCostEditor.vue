<template>
  <div>
    <div class="flex min-w-[260px] items-end gap-2">
      <input
        :value="draftValue"
        type="number"
        min="0.01"
        step="0.01"
        class="w-full rounded-xl border border-sand bg-white px-2.5 py-2 text-sm text-ink outline-none transition focus:border-clay"
        @input="emit('update:draftValue', ($event.target as HTMLInputElement).value)"
      />
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="isSaving || isArticleSaving"
          @click="emit('save')"
        >
          {{ isSaving ? '...' : 'Сохранить' }}
        </button>
        <button
          type="button"
          class="whitespace-nowrap rounded-xl border border-sand bg-white px-3 py-2 text-xs font-medium text-ink transition hover:border-clay hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="isSaving || isArticleSaving"
          @click="emit('saveArticle')"
        >
          {{ isArticleSaving ? '...' : 'Все размеры' }}
        </button>
      </div>
    </div>
    <p v-if="isSuccess" class="mt-1 text-[11px] text-emerald-700">Сохранено</p>
    <p v-if="errorMessage" class="mt-1 text-[11px] text-red-700">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  draftValue: string
  isSaving: boolean
  isArticleSaving: boolean
  isSuccess: boolean
  errorMessage: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  'update:draftValue': [value: string]
  save: []
  saveArticle: []
}>()
</script>
