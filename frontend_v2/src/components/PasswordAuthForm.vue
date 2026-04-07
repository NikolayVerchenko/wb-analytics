<template>
  <section class="password-auth">
    <div class="password-auth-tabs" role="tablist" aria-label="Режим входа">
      <button
        type="button"
        class="password-auth-tab"
        :class="{ 'password-auth-tab-active': mode === 'login' }"
        @click="setMode('login')"
      >
        Вход
      </button>
      <button
        type="button"
        class="password-auth-tab"
        :class="{ 'password-auth-tab-active': mode === 'register' }"
        @click="setMode('register')"
      >
        Регистрация
      </button>
    </div>

    <form class="password-auth-form" @submit.prevent="submit">
      <label v-if="mode === 'register'" class="password-auth-field">
        <span class="password-auth-label">Имя</span>
        <input v-model.trim="name" class="password-auth-input" type="text" autocomplete="name" />
      </label>

      <label class="password-auth-field">
        <span class="password-auth-label">Email</span>
        <input v-model.trim="email" class="password-auth-input" type="email" autocomplete="email" />
      </label>

      <label class="password-auth-field">
        <span class="password-auth-label">Пароль</span>
        <input
          v-model="password"
          class="password-auth-input"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        />
      </label>

      <RouterLink v-if="mode === 'login'" to="/forgot-password" class="password-auth-link">
        Забыли пароль?
      </RouterLink>

      <button type="submit" class="password-auth-submit" :disabled="submitting">
        {{ submitting ? 'Проверяем...' : mode === 'login' ? 'Войти' : 'Создать аккаунт' }}
      </button>

      <p v-if="status === 'idle'" class="password-auth-hint">
        {{ mode === 'login' ? 'Войдите по email и паролю.' : 'Создайте аккаунт по email и паролю.' }}
      </p>
      <p v-else-if="status === 'success'" class="password-auth-success">Вход выполнен. Переходим дальше...</p>
      <p v-else class="password-auth-error">{{ errorMessage }}</p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiPost } from '../api/http'
import { applyLoginSession } from '../auth/store'
import { getPostLoginRoute } from '../auth/post-login'

type Mode = 'login' | 'register'
type Status = 'idle' | 'success' | 'error'

type AuthResponse = {
  access_token: string
  token_type: string
  user: {
    id: string
    name: string | null
    email: string
    status: string
    telegram_linked: boolean
  }
}

const mode = ref<Mode>('login')
const status = ref<Status>('idle')
const submitting = ref(false)
const errorMessage = ref('')

const name = ref('')
const email = ref('')
const password = ref('')

function setMode(nextMode: Mode) {
  mode.value = nextMode
  status.value = 'idle'
  errorMessage.value = ''
}

function normalizeAuthError(error: unknown, currentMode: Mode) {
  if (!(error instanceof Error)) {
    return currentMode === 'login' ? 'Не удалось выполнить вход.' : 'Не удалось создать аккаунт.'
  }

  const message = error.message.trim()

  if (message === 'User with this email already exists.') {
    return 'Пользователь с таким email уже существует. Переключитесь на вкладку «Вход» и войдите в существующий аккаунт.'
  }

  if (message === 'Invalid email or password.') {
    return 'Неверный email или пароль.'
  }

  if (message === 'Authentication required') {
    return 'Нужна авторизация. Попробуйте войти ещё раз.'
  }

  return message || (currentMode === 'login' ? 'Не удалось выполнить вход.' : 'Не удалось создать аккаунт.')
}

async function submit() {
  status.value = 'idle'
  errorMessage.value = ''

  if (!email.value || !password.value || (mode.value === 'register' && !name.value)) {
    status.value = 'error'
    errorMessage.value = 'Заполните все обязательные поля.'
    return
  }

  submitting.value = true
  try {
    const payload =
      mode.value === 'login'
        ? { email: email.value, password: password.value }
        : { name: name.value, email: email.value, password: password.value }

    const response = await apiPost<AuthResponse, typeof payload>(
      mode.value === 'login' ? '/api/auth/password/login' : '/api/auth/password/register',
      payload,
    )

    applyLoginSession(response)
    const nextPath = await getPostLoginRoute()
    status.value = 'success'
    window.setTimeout(() => {
      window.location.assign(nextPath)
    }, 600)
  } catch (error) {
    status.value = 'error'
    errorMessage.value = normalizeAuthError(error, mode.value)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.password-auth {
  display: grid;
  gap: 14px;
}

.password-auth-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 12px;
  width: fit-content;
}

.password-auth-tab {
  border: none;
  background: transparent;
  color: #4b5563;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.password-auth-tab-active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.password-auth-form {
  display: grid;
  gap: 12px;
}

.password-auth-field {
  display: grid;
  gap: 6px;
}

.password-auth-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.password-auth-input {
  width: 100%;
  border: 1px solid #dbe1ea;
  border-radius: 12px;
  padding: 11px 13px;
  font-size: 14px;
  color: #111827;
  background: #ffffff;
}

.password-auth-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.08);
}

.password-auth-link {
  width: fit-content;
  color: #4338ca;
  font-size: 13px;
  text-decoration: none;
}

.password-auth-submit {
  border: none;
  border-radius: 12px;
  background: #111827;
  color: #ffffff;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.password-auth-submit:disabled {
  opacity: 0.65;
  cursor: default;
}

.password-auth-hint,
.password-auth-success,
.password-auth-error {
  margin: 0;
  font-size: 13px;
}

.password-auth-hint {
  color: #6b7280;
}

.password-auth-success {
  color: #15803d;
}

.password-auth-error {
  color: #b91c1c;
}
</style>
