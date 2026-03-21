import { createRouter, createWebHistory } from 'vue-router'

import AccountsPage from '../pages/AccountsPage.vue'
import UnitEconomicsPage from '../pages/UnitEconomicsPage.vue'
import SuppliesPage from '../pages/SuppliesPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/economics',
    },
    {
      path: '/economics',
      name: 'economics',
      component: UnitEconomicsPage,
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: AccountsPage,
    },
    {
      path: '/supplies',
      name: 'supplies',
      component: SuppliesPage,
    },
  ],
})
