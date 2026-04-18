<template>
  <section class="card stack connect-account-section">
    <div class="connect-account-header">
      <h2 class="page-title">Подключить кабинет</h2>
      <p class="page-description connect-account-description">
        Вставьте рабочий API токен Wildberries. Мы проверим кабинет, создадим связь и дадим вам роль владельца.
      </p>
    </div>

    <div class="connect-account-summary">
      <div class="totals-item">
        <span class="totals-label">Что произойдёт</span>
        <span class="totals-value connect-account-summary-value">Кабинет появится в списке</span>
      </div>
      <div class="totals-item">
        <span class="totals-label">Доступ</span>
        <span class="totals-value connect-account-summary-value">Вы станете владельцем</span>
      </div>
    </div>

    <form class="stack connect-account-form" @submit.prevent="submit">
      <label class="field">
        <span class="connect-account-label">API токен WB</span>
        <textarea
          v-model.trim="token"
          class="connect-account-textarea"
          rows="5"
          spellcheck="false"
          autocomplete="off"
          placeholder="Вставьте токен кабинета Wildberries"
        ></textarea>
      </label>

      <label class="field">
        <span class="connect-account-label">Название кабинета</span>
        <input
          v-model.trim="name"
          class="connect-account-input"
          type="text"
          placeholder="Необязательно. Если пусто, возьмём имя из WB"
        />
      </label>

      <div class="connect-account-actions">
        <button type="submit" class="primary-button" :disabled="submitting">
          {{ submitting ? 'Подключаем...' : 'Подключить кабинет' }}
        </button>
      </div>
    </form>

    <div v-if="status === 'idle'" class="message message-empty connect-account-message">
      После подключения кабинет сразу станет доступен в аналитике, остатках и поставках.
    </div>
    <div v-else-if="status === 'success'" class="message message-info connect-account-message">
      Кабинет подключён. Переходим к списку кабинетов...
    </div>
    <div v-else class="message message-error connect-account-message">
      {{ errorMessage }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { connectAccount } from '../api/accounts'

type Status = 'idle' | 'success' | 'error'

const router = useRouter()
const token = ref('')
const name = ref('')
const status = ref<Status>('idle')
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  status.value = 'idle'
  errorMessage.value = ''

  if (!token.value) {
    status.value = 'error'
    errorMessage.value = 'Введите API токен кабинета Wildberries.'
    return
  }

  if (token.value.length < 20) {
    status.value = 'error'
    errorMessage.value = 'Похоже, токен слишком короткий. Проверьте, что вставили его полностью.'
    return
  }

  submitting.value = true
  try {
    await connectAccount({
      token: token.value,
      name: name.value || null,
    })

    status.value = 'success'
    window.setTimeout(() => {
      router.push({ name: 'settings' })
    }, 700)
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Не удалось подключить кабинет.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.connect-account-section {
  max-width: 760px;
  margin: 0 auto;
}

.connect-account-header {
  display: grid;
  gap: 4px;
}

.connect-account-description {
  margin-bottom: 0;
}

.connect-account-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.connect-account-summary-value {
  font-size: 16px;
}

.connect-account-form {
  gap: 14px;
}

.connect-account-label {
  font-size: 14px;
  color: #374151;
}

.connect-account-input,
.connect-account-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
  color: #111827;
  resize: vertical;
}

.connect-account-textarea {
  min-height: 120px;
}

.connect-account-input:focus,
.connect-account-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.connect-account-actions {
  display: flex;
  justify-content: flex-start;
}

.connect-account-message {
  margin: 0;
}
</style>
