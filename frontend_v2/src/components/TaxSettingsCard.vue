<template>
  <div class="card tax-settings-card">
    <div class="section-toolbar">
      <div class="section-toolbar-title">
        <h3 class="section-title">Налоговая ставка</h3>
        <p class="tax-settings-description">
          Используется для расчёта колонки `Налог` в полной аналитике.
        </p>
      </div>
      <div class="section-toolbar-actions">
        <span class="account-pill">На кабинет</span>
      </div>
    </div>

    <div v-if="loading" class="message message-info">Загрузка налоговой ставки...</div>
    <form v-else class="tax-settings-form" @submit.prevent="handleSubmit">
      <div class="field">
        <label for="tax-rate">Ставка, %</label>
        <input id="tax-rate" v-model="draftRate" type="number" min="0" max="100" step="0.01" placeholder="Например, 6" />
      </div>

      <div class="field">
        <label for="tax-effective-from">Действует с</label>
        <input id="tax-effective-from" v-model="draftEffectiveFrom" type="date" />
      </div>

      <div class="tax-settings-actions">
        <button type="submit" class="primary-button" :disabled="loading || saving">
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        <span class="tax-settings-hint">После сохранения витрина экономики пересчитывается в фоне.</span>
      </div>
    </form>

    <div v-if="error" class="message message-error">{{ error }}</div>
    <div v-else-if="message" class="message message-info">{{ message }}</div>
  </div>
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
  save: []
}>()

function handleSubmit() {
  if (props.loading || props.saving) {
    return
  }
  emit('save')
}
</script>

<style scoped>
.tax-settings-card {
  display: grid;
  gap: 16px;
}

.tax-settings-description {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.tax-settings-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 220px)) minmax(260px, 1fr);
  gap: 12px;
  align-items: end;
}

.tax-settings-actions {
  display: grid;
  gap: 8px;
}

.tax-settings-hint {
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 900px) {
  .tax-settings-form {
    grid-template-columns: 1fr;
  }
}
</style>
