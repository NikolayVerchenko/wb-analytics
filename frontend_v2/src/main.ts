import { createApp } from 'vue'
import App from './App.vue'
import { bootstrapAuth } from './auth/store'
import router from './router'
import './style.css'

bootstrapAuth().finally(() => {
  createApp(App).use(router).mount('#app')
})
