<template>
  <section class="auth-page">
    <div class="auth-card auth-card-narrow">
      <h1 class="auth-title">Сброс пароля</h1>
      <p class="auth-subtitle">
        Введите email. Если аккаунт существует, мы подготовим ссылку для сброса пароля.
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="auth-field">
          <span class="auth-label">Email</span>
          <input v-model.trim="email" class="auth-input" type="email" autocomplete="email" />
        </label>

        <button type="submit" class="auth-submit" :disabled="submitting">
          {{ submitting ? 'Проверяем...' : 'Отправить ссылку' }}
        </button>
      </form>

      <div v-if="status === 'success'" class="auth-message auth-message-success">
        <p>{{ successMessage }}</p>
        <a v-if="resetUrl" :href="resetUrl" class="auth-dev-link">Открыть ссылку сброса</a>
      </div>
      <p v-else-if="status === 'error'" class="auth-message auth-message-error">{{ errorMessage }}</p>

      <RouterLink to="/register" class="auth-link">Вернуться ко входу</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiPost } from '../api/http'

type ForgotPasswordResponse = {
  success: boolean
  message: string
  reset_url?: string | null
}

type Status = 'idle' | 'success' | 'error'

const email = ref('')
const submitting = ref(false)
const status = ref<Status>('idle')
const errorMessage = ref('')
const successMessage = ref('')
const resetUrl = ref('')

async function submit() {
  status.value = 'idle'
  errorMessage.value = ''
  successMessage.value = ''
  resetUrl.value = ''

  if (!email.value) {
    status.value = 'error'
    errorMessage.value = 'Введите email.'
    return
  }

  submitting.value = true
  try {
    const response = await apiPost<ForgotPasswordResponse, { email: string }>('/api/auth/password/forgot', {
      email: email.value,
    })
    status.value = 'success'
    successMessage.value = response.message
    resetUrl.value = response.reset_url || ''
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Не удалось подготовить сброс пароля.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  padding: 40px 0;
}

.auth-card {
  width: min(560px, 100%);
  padding: 28px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 16px;
}

.auth-card-narrow {
  width: min(520px, 100%);
}

.auth-title {
  margin: 0;
  font-size: 26px;
  color: #111827;
}

.auth-subtitle {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.auth-form {
  display: grid;
  gap: 12px;
}

.auth-field {
  display: grid;
  gap: 6px;
}

.auth-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.auth-input {
  width: 100%;
  border: 1px solid #dbe1ea;
  border-radius: 12px;
  padding: 11px 13px;
  font-size: 14px;
  color: #111827;
  background: #ffffff;
}

.auth-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.08);
}

.auth-submit {
  border: none;
  border-radius: 12px;
  background: #111827;
  color: #ffffff;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.auth-submit:disabled {
  opacity: 0.65;
  cursor: default;
}

.auth-message {
  margin: 0;
  font-size: 13px;
}

.auth-message-success {
  color: #15803d;
  display: grid;
  gap: 8px;
}

.auth-message-success p {
  margin: 0;
}

.auth-message-error {
  color: #b91c1c;
}

.auth-dev-link,
.auth-link {
  color: #4338ca;
  font-size: 13px;
  text-decoration: none;
}
</style>
