import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { container } from './core/di/container'
import './presentation/utils/syncDebugUtils' // Утилиты для отладки синхронизации

// Инициализация DI контейнера
// Используем API ключ из localStorage (как в новой системе синхронизации)
// Если ключа нет, используем переменную окружения (для первоначальной настройки)
const API_KEY = localStorage.getItem('wb_api_key') || import.meta.env.VITE_WB_API_KEY || ''
if (API_KEY) {
  container.initialize(API_KEY)
} else {
  console.warn('API ключ не найден. Укажите его в настройках или в переменной окружения VITE_WB_API_KEY')
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')
