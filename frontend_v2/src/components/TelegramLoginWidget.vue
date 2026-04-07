<template>
  <div class="telegram-login">
    <div ref="widgetRef" class="telegram-login-widget"></div>

    <p v-if="status === 'idle'" class="telegram-login-hint">
      Нажмите кнопку, чтобы подтвердить вход через Telegram.
    </p>
    <p v-else-if="status === 'loading'" class="telegram-login-hint">Проверяем данные Telegram...</p>
    <p v-else-if="status === 'success'" class="telegram-login-success">
      Вход выполнен. Переходим дальше...
    </p>
    <p v-else class="telegram-login-error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { apiPost } from '../api/http'
import { getPostLoginRoute } from '../auth/post-login'
import { applyLoginSession } from '../auth/store'

type TelegramAuthPayload = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

type TelegramLoginResponse = {
  access_token: string
  is_new_user: boolean
  user: {
    id: string
    name: string | null
    email: string
    status: string
    telegram_linked: boolean
  }
}

type Status = 'idle' | 'loading' | 'success' | 'error'

const widgetRef = ref<HTMLDivElement | null>(null)
const status = ref<Status>('idle')
const errorMessage = ref('')
let redirectTimer: number | null = null

const botName = (import.meta.env.VITE_TELEGRAM_BOT_NAME as string | undefined) || ''

function mountWidget() {
  if (!widgetRef.value) {
    return
  }

  widgetRef.value.innerHTML = ''
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', botName)
  script.setAttribute('data-size', 'medium')
  script.setAttribute('data-userpic', 'false')
  script.setAttribute('data-request-access', 'write')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')
  widgetRef.value.appendChild(script)
}

async function handleTelegramAuth(user: TelegramAuthPayload) {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    const response = await apiPost<TelegramLoginResponse, TelegramAuthPayload>(
      '/api/auth/telegram/login',
      user,
    )
    applyLoginSession(response)
    const nextPath = await getPostLoginRoute()
    status.value = 'success'
    scheduleRedirect(nextPath)
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : 'Не удалось выполнить вход.'
  }
}

function scheduleRedirect(nextPath: string) {
  if (redirectTimer !== null) {
    window.clearTimeout(redirectTimer)
  }

  redirectTimer = window.setTimeout(() => {
    window.location.assign(nextPath)
  }, 800)
}

function applyStatusFromUrl() {
  const url = new URL(window.location.href)
  const authStatus = url.searchParams.get('auth')
  if (!authStatus) {
    return
  }

  if (authStatus === 'success') {
    status.value = 'success'
    errorMessage.value = ''
    scheduleRedirect('/accounts')
  } else {
    status.value = 'error'
    errorMessage.value = url.searchParams.get('message') || 'Не удалось выполнить вход.'
  }

  ;['auth', 'message', 'is_new_user'].forEach((key) => url.searchParams.delete(key))
  window.history.replaceState({}, document.title, url.toString())
}

onMounted(() => {
  if (!botName) {
    status.value = 'error'
    errorMessage.value = 'Не задан VITE_TELEGRAM_BOT_NAME в окружении.'
    return
  }

  ;(window as Window & { onTelegramAuth?: (user: TelegramAuthPayload) => void }).onTelegramAuth =
    handleTelegramAuth
  mountWidget()
  applyStatusFromUrl()
})

onBeforeUnmount(() => {
  const windowWithHandler = window as Window & { onTelegramAuth?: (user: TelegramAuthPayload) => void }
  if (windowWithHandler.onTelegramAuth === handleTelegramAuth) {
    delete windowWithHandler.onTelegramAuth
  }
  if (redirectTimer !== null) {
    window.clearTimeout(redirectTimer)
  }
})
</script>

<style scoped>
.telegram-login {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.telegram-login-widget {
  min-height: 36px;
}

.telegram-login-hint {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.telegram-login-success {
  margin: 0;
  font-size: 13px;
  color: #15803d;
}

.telegram-login-error {
  margin: 0;
  font-size: 13px;
  color: #b91c1c;
}
</style>
