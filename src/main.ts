import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
// Утилиты для отладки синхронизации
import './presentation/utils/syncDebugUtils'
import { container } from '@/core/di/container'

// Примечание: Инициализация API ключа происходит в компонентах через SyncManager
// API ключ хранится в localStorage и загружается при необходимости

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const apiKey = localStorage.getItem('wb_api_key')

if (apiKey) {
  try {
    container.reinitialize()
  } catch (e) {
    console.error('DI container initialization failed', e)
  }
}

app.mount('#app')
