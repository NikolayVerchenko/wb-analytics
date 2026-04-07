<template>
  <section class="auth-page">
    <div class="auth-card auth-card-narrow">
      <h1 class="auth-title">Новый пароль</h1>
      <p class="auth-subtitle">
        Задайте новый пароль для аккаунта и затем войдите с ним обычным способом.
      </p>

      <UiStateBlock
        v-if="!token"
        title="Ссылка недействительна"
        description="Откройте страницу сброса по ссылке из письма или dev-сообщения."
        variant="empty"
      />

      <template v-else>
        <form class="auth-form" @submit.prevent="submit">
          <label class="auth-field">
            <span class="auth-label">Новый пароль</span>
            <input v-model="password" class="auth-input" type="password" autocomplete="new-password" />
          </label>

          <label class="auth-field">
            <span class="auth-label">Повторите пароль</span>
            <input v-model="confirmPassword" class="auth-input" type="password" autocomplete="new-password" />
          </label>

          <button type="submit" class="auth-submit" :disabled="submitting">
            {{ submitting ? 'Сохраняем...' : 'Сохранить пароль' }}
          </button>
        </form>

        <p v-if="status === 'success'" class="auth-message auth-message-success">{{ successMessage }}</p>
        <p v-else-if="status === 'error'" class="auth-message auth-message-error">{{ errorMessage }}</p>
      </template>

      <RouterLink to="/register" class="auth-link">Вернуться ко входу</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import UiStateBlock from '../components/UiStateBlock.vue'
import { apiPost } from '../api/http'

type ResetPasswordResponse = {
  success: boolean
  message: string
}

type Status = 'idle' | 'success' | 'error'

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const status = ref<Status>('idle')
const errorMessage = ref('')
const successMessage = ref('')

function normalizeResetError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Не удалось сохранить новый пароль.'
  }

  if (error.message === 'Reset token is invalid or expired.') {
    return 'Ссылка для сброса пароля недействительна или устарела.'
  }

  if (error.message === 'User is not active.') {
    return 'Пользователь неактивен. Обратитесь к администратору.'
  }

  return error.message || 'Не удалось сохранить новый пароль.'
}

async function submit() {
  status.value = 'idle'
  errorMessage.value = ''
  successMessage.value = ''

  if (!token.value) {
    status.value = 'error'
    errorMessage.value = 'Ссылка сброса отсутствует.'
    return
  }

  if (!password.value || !confirmPassword.value) {
    status.value = 'error'
    errorMessage.value = 'Заполните оба поля пароля.'
    return
  }

  if (password.value.length < 8) {
    status.value = 'error'
    errorMessage.value = 'Пароль должен содержать минимум 8 символов.'
    return
  }

  if (password.value !== confirmPassword.value) {
    status.value = 'error'
    errorMessage.value = 'Пароли не совпадают.'
    return
  }

  submitting.value = true
  try {
    const response = await apiPost<ResetPasswordResponse, { token: string; password: string }>(
      '/api/auth/password/reset',
      {
        token: token.value,
        password: password.value,
      },
    )
    status.value = 'success'
    successMessage.value = response.message
  } catch (error) {
    status.value = 'error'
    errorMessage.value = normalizeResetError(error)
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
}

.auth-message-error {
  color: #b91c1c;
}

.auth-link {
  color: #4338ca;
  font-size: 13px;
  text-decoration: none;
}
</style>
