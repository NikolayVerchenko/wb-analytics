import { computed, ref, watch } from 'vue'
import { getTaxSettings, putTaxSettings } from '../api/tax'

function formatDate(value?: string | null) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}

export function useTaxSettings(params: { accountId: () => string }) {
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const message = ref('')
  const taxRatePercent = ref('')
  const effectiveFrom = ref('')

  const hasAccount = computed(() => Boolean(params.accountId()))

  async function load() {
    if (!params.accountId()) {
      taxRatePercent.value = ''
      effectiveFrom.value = ''
      error.value = ''
      message.value = ''
      return
    }

    loading.value = true
    error.value = ''
    message.value = ''

    try {
      const settings = await getTaxSettings(params.accountId())
      taxRatePercent.value = settings.tax_rate_percent == null ? '' : String(settings.tax_rate_percent)
      effectiveFrom.value = formatDate(settings.effective_from)
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Не удалось загрузить налоговую ставку.'
      if (messageText === 'Tax settings not found') {
        taxRatePercent.value = ''
        effectiveFrom.value = formatDate(new Date().toISOString())
        error.value = ''
        return
      }
      error.value = messageText
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!params.accountId()) {
      return
    }

    const rate = Number(taxRatePercent.value.replace(',', '.'))
    if (!taxRatePercent.value.trim() || Number.isNaN(rate) || rate <= 0 || rate > 100) {
      error.value = 'Введите ставку налога от 0 до 100%.'
      message.value = ''
      return
    }

    saving.value = true
    error.value = ''
    message.value = ''

    try {
      const response = await putTaxSettings(params.accountId(), {
        tax_rate_percent: rate,
        effective_from: effectiveFrom.value || undefined,
      })
      taxRatePercent.value = response.tax_rate_percent == null ? '' : String(response.tax_rate_percent)
      effectiveFrom.value = formatDate(response.effective_from)
      message.value = 'Сохранено. Витрина пересчитывается в фоне.'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось сохранить налоговую ставку.'
    } finally {
      saving.value = false
    }
  }

  watch(() => params.accountId(), async () => {
    await load()
  }, { immediate: true })

  return {
    hasAccount,
    loading,
    saving,
    error,
    message,
    taxRatePercent,
    effectiveFrom,
    save,
  }
}
