<template>
  <section class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">Вход и регистрация</h1>
      <p class="auth-subtitle">
        Выберите удобный способ: быстрый вход через Telegram или обычный вход по email и паролю.
      </p>

      <div class="auth-grid">
        <div class="auth-section">
          <div class="auth-section-header">
            <h2 class="auth-section-title">Telegram</h2>
            <p class="auth-section-text">
              Быстрый вход через текущий Telegram-аккаунт в браузере.
            </p>
          </div>

          <template v-if="showLocalDevTelegramNote">
            <div class="auth-note auth-note-muted">
              Telegram-вход на локальном dev-адресе недоступен. Для локальной разработки используйте email и пароль
              или открывайте страницу через публичный домен / ngrok.
            </div>
          </template>
          <template v-else>
            <TelegramLoginWidget />
          </template>
        </div>

        <div class="auth-divider" aria-hidden="true"></div>

        <div class="auth-section">
          <div class="auth-section-header">
            <h2 class="auth-section-title">Email и пароль</h2>
            <p class="auth-section-text">
              Обычный вход и регистрация без зависимости от Telegram-сессии.
            </p>
          </div>
          <PasswordAuthForm />
        </div>
      </div>

      <p class="auth-footer">
        После входа вы сможете работать как через Telegram, так и через email-пароль.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PasswordAuthForm from '../components/PasswordAuthForm.vue'
import TelegramLoginWidget from '../components/TelegramLoginWidget.vue'

const showLocalDevTelegramNote = computed(() => {
  if (typeof window === 'undefined') {
    return false
  }

  return import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(window.location.hostname)
})
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  padding: 40px 0;
}

.auth-card {
  width: min(760px, 100%);
  padding: 28px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 16px;
}

.auth-grid {
  display: grid;
  gap: 20px;
}

.auth-section {
  display: grid;
  gap: 14px;
}

.auth-section-header {
  display: grid;
  gap: 4px;
}

.auth-section-title {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.auth-section-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.auth-note {
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
}

.auth-note-muted {
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #475569;
}

.auth-divider {
  height: 1px;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0), rgba(226, 232, 240, 1), rgba(226, 232, 240, 0));
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

.auth-footer {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
</style>
