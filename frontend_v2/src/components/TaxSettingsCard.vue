<template>
  <section class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="grid gap-1">
        <h3 class="text-lg font-semibold text-zinc-900">Налоговая ставка</h3>
        <p class="text-sm text-zinc-600">Применяется в расчётах полной аналитики.</p>
      </div>
    </div>

    <div v-if="loading" class="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      Загрузка налоговой ставки...
    </div>
    <div v-else class="mt-5 grid gap-3 md:grid-cols-[220px_220px_minmax(280px,1fr)] md:items-end">
      <div class="grid gap-1.5">
        <label for="tax-rate" class="text-sm font-medium text-zinc-700">Ставка, %</label>
        <input
          id="tax-rate"
          v-model="draftRate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="Например, 6"
          class="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
        />
      </div>

      <div class="grid gap-1.5">
        <label for="tax-effective-from" class="text-sm font-medium text-zinc-700">Действует с</label>
        <input
          id="tax-effective-from"
          v-model="draftEffectiveFrom"
          type="date"
          class="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
        />
      </div>

      <div class="grid gap-2">
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || saving"
          @click="handleSubmit"
        >
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        <span class="text-xs text-zinc-500">После сохранения витрина экономики пересчитывается сразу.</span>
      </div>
    </div>

    <div v-if="error" class="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</div>
    <div v-else-if="message" class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ message }}</div>
  </section>
</template>

<script setup lang="ts">
const draftRate = defineModel<string>('taxRate', { required: true })
const draftEffectiveFrom = defineModel<string>('effectiveFrom', { required: true })

const props = defineProps<{
  loading: boolean
  saving: boolean
  error: string
  message: string
}>()

const emit = defineEmits<{
  saveTaxSettings: []
}>()

function handleSubmit() {
  if (props.loading || props.saving) {
    return
  }
  emit('saveTaxSettings')
}
</script>
