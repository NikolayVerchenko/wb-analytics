import { createRouter, createWebHistory } from 'vue-router'
import { bootstrapAuth, isAuthenticated } from './auth/store'
import AccountsPage from './pages/AccountsPage.vue'
import ConnectAccountPage from './pages/ConnectAccountPage.vue'
import ForgotPasswordPage from './pages/ForgotPasswordPage.vue'
import StockSnapshotPage from './pages/StockSnapshotPage.vue'
import SuppliesPage from './pages/SuppliesPage.vue'
import SyncJobsPage from './pages/SyncJobsPage.vue'
import UnitEconomicsPage from './pages/UnitEconomicsPage.vue'
import ProblemsEconomicsPage from './pages/ProblemsEconomicsPage.vue'
import RegisterPage from './pages/RegisterPage.vue'
import ResetPasswordPage from './pages/ResetPasswordPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/settings',
    },
    {
      path: '/settings',
      name: 'settings',
      component: AccountsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/accounts',
      redirect: '/settings',
    },
    {
      path: '/connect-account',
      name: 'connect-account',
      component: ConnectAccountPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
      meta: { guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordPage,
      meta: { guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordPage,
      meta: { guestOnly: true },
    },
    {
      path: '/economics/problems',
      name: 'economics-problems',
      component: ProblemsEconomicsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/economics',
      name: 'economics',
      component: UnitEconomicsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/stocks',
      name: 'stocks',
      component: StockSnapshotPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/supplies',
      name: 'supplies',
      component: SuppliesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/sync',
      name: 'sync',
      component: SyncJobsPage,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  await bootstrapAuth()

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { name: 'settings' }
  }

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'register' }
  }

  return true
})

export default router
