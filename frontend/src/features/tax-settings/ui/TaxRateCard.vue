<template>
  <div class="rounded-[24px] border border-sand/70 bg-white/92 p-4 shadow-soft">
    <div class="flex flex-col gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-clay">Налог</p>
        <p class="mt-1.5 text-[15px] font-semibold text-ink">Ставка кабинета</p>
        <p class="mt-1 text-[13px] leading-5 text-ink/62">Ставка применяется к реализации после СПП и участвует в расчете прибыли.</p>
      </div>

      <div v-if="!accountId" class="rounded-2xl bg-paper px-4 py-4 text-sm text-ink/55">
        Выбери кабинет, чтобы задать ставку.
      </div>

      <template v-else>
        <div class="flex items-end gap-3">
          <label class="flex min-w-0 flex-1 flex-col gap-2 text-sm text-ink/70">
            <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">Ставка, %</span>
            <input
              v-model="taxRateInput"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              class="rounded-[18px] border border-sand bg-paper px-4 py-2.5 text-sm text-ink outline-none transition focus:border-mint focus:bg-white"
            />
          </label>

          <button
            type="button"
            class="rounded-[18px] bg-moss px-4 py-2.5 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canSave || isSaving"
            @click="save"
          >
            {{ isSaving ? 'Сохраняю...' : 'Сохранить' }}
          </button>
        </div>

        <div v-if="isLoading" class="rounded-2xl bg-paper px-3 py-3 text-sm text-ink/55">Загружаю ставку...</div>
        <div v-else-if="savedTaxRate !== null" class="rounded-2xl bg-mint-soft px-3 py-3 text-sm text-ink/70">
          Текущая ставка: <strong class="text-ink">{{ formatPercent(savedTaxRate) }}</strong>
        </div>

        <div v-if="successMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ successMessage }}
        </div>

        <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ errorMessage }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { fetchTaxSettings, saveTaxSettings } from '../../../entities/tax/api/taxSettingsApi'

const props = defineProps<{
  accountId: string | null
}>()

const taxRateInput = ref('')
const savedTaxRate = ref<number | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const canSave = computed(() => {
  const value = Number(taxRateInput.value)
  return Boolean(props.accountId) && Number.isFinite(value) && value > 0 && value <= 100
})

watch(
  () => props.accountId,
  async (accountId) => {
    taxRateInput.value = ''
    savedTaxRate.value = null
    errorMessage.value = null
    successMessage.value = null

    if (!accountId) {
      return
    }

    isLoading.value = true
    try {
      const settings = await fetchTaxSettings(accountId)
      const value = Number(settings.tax_rate_percent)
      savedTaxRate.value = value
      taxRateInput.value = Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : ''
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Не удалось загрузить ставку'
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

async function save() {
  if (!props.accountId || !canSave.value) {
    return
  }

  isSaving.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const settings = await saveTaxSettings(props.accountId, {
      tax_rate_percent: Number(taxRateInput.value),
    })
    const value = Number(settings.tax_rate_percent)
    savedTaxRate.value = value
    taxRateInput.value = Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : ''
    successMessage.value = 'Ставка сохранена'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Не удалось сохранить ставку'
  } finally {
    isSaving.value = false
  }
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`
}
</script>
