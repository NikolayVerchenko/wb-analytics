import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../presentation/components/Dashboard.vue'
import SummaryView from '../presentation/components/SummaryView.vue'
import ReportSyncPanel from '../presentation/components/ReportSyncPanel.vue'
import ProductsView from '../presentation/components/ProductsView.vue'
import PurchaseOrdersView from '../presentation/components/PurchaseOrdersView.vue'
import ShipmentsView from '../presentation/components/ShipmentsView.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
  },
  {
    path: '/summary',
    name: 'Summary',
    component: SummaryView,
  },
  {
    path: '/products',
    name: 'Products',
    component: ProductsView,
  },
  {
    path: '/purchases',
    name: 'Purchases',
    component: PurchaseOrdersView,
  },
  {
    path: '/shipments',
    name: 'Shipments',
    component: ShipmentsView,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: ReportSyncPanel,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

