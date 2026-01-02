import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import './presentation/utils/syncDebugUtils' // Утилиты для отладки синхронизации

// Примечание: Инициализация API ключа происходит в компонентах через SyncManager
// API ключ хранится в localStorage и загружается при необходимости

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')
