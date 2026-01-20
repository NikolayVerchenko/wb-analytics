import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../presentation/components/Dashboard.vue'
import SummaryView from '../presentation/components/SummaryView.vue'
import ReportSyncPanel from '../presentation/components/ReportSyncPanel.vue'
import ProductsView from '../presentation/components/ProductsView.vue'
import SuppliesView from '../presentation/components/SuppliesView.vue'
import SalesView from '../presentation/components/SalesView.vue'
import FinanceView from '../presentation/components/FinanceView.vue'
import BatchManagementView from '../presentation/components/BatchManagementView.vue'
import ZakupkiView from '../presentation/components/ZakupkiView.vue'
import PulseView from '../presentation/components/PulseView.vue'
import SyncView from '../views/SyncView.vue'
import CostsView from '../views/CostsView.vue'
import PurchasesListView from '../presentation/components/purchases/PurchasesListView.vue'
import PurchasesEditorView from '../presentation/components/purchases/PurchasesEditorView.vue'
import StartupLogsView from '../presentation/components/StartupLogsView.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
  },
  {
    path: '/sync',
    name: 'Sync',
    component: SyncView,
  },
  {
    path: '/costs',
    name: 'Costs',
    component: CostsView,
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
    component: PurchasesListView,
  },
  {
    path: '/purchases/new',
    name: 'PurchasesNew',
    component: PurchasesEditorView,
  },
  {
    path: '/purchases/:id',
    name: 'PurchasesEdit',
    component: PurchasesEditorView,
    props: true,
  },
  {
    path: '/shipments',
    name: 'Shipments',
    component: SuppliesView,
  },
  {
    path: '/sales',
    name: 'Sales',
    component: SalesView,
  },
  {
    path: '/finance',
    name: 'Finance',
    component: FinanceView,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: ReportSyncPanel,
  },
  {
    path: '/startup-logs',
    name: 'StartupLogs',
    component: StartupLogsView,
  },
  {
    path: '/batches',
    name: 'Batches',
    component: BatchManagementView,
  },
  {
    path: '/zakupki',
    name: 'Zakupki',
    component: ZakupkiView,
  },
  {
    path: '/pulse',
    name: 'Pulse',
    component: PulseView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
