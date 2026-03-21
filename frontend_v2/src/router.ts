import { createRouter, createWebHistory } from 'vue-router'
import AccountsPage from './pages/AccountsPage.vue'
import UnitEconomicsPage from './pages/UnitEconomicsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/accounts',
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: AccountsPage,
    },
    {
      path: '/economics',
      name: 'economics',
      component: UnitEconomicsPage,
    },
  ],
})

export default router
