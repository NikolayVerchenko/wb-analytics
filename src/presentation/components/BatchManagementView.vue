<template>
  <div class="space-y-6">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">Управление партиями</h2>
      <button
        v-if="!selectedGroupId"
        @click="showCreateForm = true"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus class="w-4 h-4" />
        Создать новую группу
      </button>
      <button
        v-else
        @click="selectedGroupId = null"
        class="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
      >
        <ArrowLeft class="w-4 h-4" />
        Назад к списку
      </button>
    </div>

    <!-- Форма создания группы -->
    <div
      v-if="showCreateForm && !selectedGroupId"
      class="bg-white p-6 rounded-lg shadow"
    >
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Новая группа поставок</h3>
      
      <form @submit.prevent="handleCreateGroup" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Название группы -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Название группы *
            </label>
            <input
              v-model="newGroup.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Группа 1"
            />
          </div>

          <!-- Дата группы -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Дата *
            </label>
            <input
              v-model="newGroup.date"
              type="date"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="isCreating"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {{ isCreating ? 'Создание...' : 'Создать группу' }}
          </button>
          <button
            type="button"
            @click="showCreateForm = false"
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>

    <!-- Список групп -->
    <div v-if="!selectedGroupId && !showCreateForm" class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Название
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Дата
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Заказов
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Поставок
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Действия
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="group in groups"
            :key="group.id"
            class="hover:bg-gray-50"
          >
            <td 
              @click="selectedGroupId = group.id!"
              class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
            >
              {{ group.name }}
            </td>
            <td 
              @click="selectedGroupId = group.id!"
              class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer"
            >
              {{ formatDate(group.date) }}
            </td>
            <td 
              @click="selectedGroupId = group.id!"
              class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 cursor-pointer"
            >
              {{ group.orderIds.length }}
            </td>
            <td 
              @click="selectedGroupId = group.id!"
              class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 cursor-pointer"
            >
              {{ group.shipmentIds.length }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <button
                @click.stop="handleDeleteGroup(group.id!)"
                class="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                title="Удалить группу"
              >
                <Trash2 class="w-5 h-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Детали группы -->
    <div v-if="selectedGroupId" class="space-y-6">
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Группа: {{ selectedGroup?.name }}
        </h3>
        <p class="text-sm text-gray-600 mb-4">
          Дата: {{ selectedGroup ? formatDate(selectedGroup.date) : '' }}
        </p>

        <!-- Кнопка запуска распределения -->
        <div class="mb-6">
          <button
            @click="handleRunDistribution"
            :disabled="isRunningDistribution || !selectedGroup || (selectedGroup.orderIds.length === 0 || selectedGroup.shipmentIds.length === 0)"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play class="w-4 h-4" />
            {{ isRunningDistribution ? 'Запуск распределения...' : 'Запустить распределение внутри группы' }}
          </button>
        </div>

        <!-- Двухколоночный макет -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Левая колонка: Заказы -->
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-md font-semibold text-gray-900">Выбранные заказы</h4>
              <button
                @click="showOrderSelector = true"
                class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Добавить заказы
              </button>
            </div>

            <!-- Статистика по заказам -->
            <div v-if="selectedGroup && selectedGroup.orderIds.length > 0" class="mb-4 p-3 bg-gray-50 rounded">
              <div class="text-sm text-gray-700">
                <div>Количество заказов: <strong>{{ selectedGroup.orderIds.length }}</strong></div>
                <div v-if="ordersSummary.totalQuantity > 0">
                  Общее количество: <strong>{{ ordersSummary.totalQuantity }} шт.</strong>
                </div>
                <div v-if="ordersSummary.totalSum > 0">
                  Общая сумма: <strong>{{ formatCurrency(ordersSummary.totalSum) }}</strong>
                </div>
              </div>
            </div>

            <!-- Список заказов -->
            <div v-if="selectedGroup && selectedGroup.orderIds.length > 0" class="space-y-2">
              <div
                v-for="orderId in selectedGroup.orderIds"
                :key="orderId"
                class="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
              >
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900">
                    {{ getOrderById(orderId)?.orderNumber || `Заказ #${orderId}` }}
                  </div>
                  <div class="text-xs text-gray-600">
                    {{ getOrderById(orderId) ? formatDate(getOrderById(orderId)!.date) : '' }}
                  </div>
                </div>
                <button
                  @click="removeOrderFromGroup(orderId)"
                  class="text-red-600 hover:text-red-800 p-1"
                  title="Удалить из группы"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500 text-center py-4">
              Нет выбранных заказов
            </div>
          </div>

          <!-- Правая колонка: Поставки -->
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-md font-semibold text-gray-900">Выбранные поставки</h4>
              <button
                @click="showShipmentSelector = true"
                class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Добавить поставки
              </button>
            </div>

            <!-- Статистика по поставкам -->
            <div v-if="selectedGroup && selectedGroup.shipmentIds.length > 0" class="mb-4 p-3 bg-gray-50 rounded">
              <div class="text-sm text-gray-700">
                <div>Количество поставок: <strong>{{ selectedGroup.shipmentIds.length }}</strong></div>
                <div v-if="shipmentsSummary.totalQuantity > 0">
                  Общее количество: <strong>{{ shipmentsSummary.totalQuantity }} шт.</strong>
                </div>
                <div>
                  Полностью покрыто: <strong>{{ shipmentsSummary.fullCoverage }}</strong>
                </div>
                <div>
                  Частично покрыто: <strong>{{ shipmentsSummary.partialCoverage }}</strong>
                </div>
                <div>
                  Без покрытия: <strong>{{ shipmentsSummary.emptyCoverage }}</strong>
                </div>
              </div>
            </div>

            <!-- Список поставок -->
            <div v-if="selectedGroup && selectedGroup.shipmentIds.length > 0" class="space-y-2">
              <div
                v-for="shipmentId in selectedGroup.shipmentIds"
                :key="shipmentId"
                class="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
              >
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900">
                    {{ getShipmentById(shipmentId)?.supplyID || getShipmentById(shipmentId)?.preorderID || `Поставка #${shipmentId}` }}
                  </div>
                  <div class="text-xs text-gray-600">
                    {{ getShipmentById(shipmentId) ? formatDate(getShipmentById(shipmentId)!.createDate) : '' }}
                  </div>
                  <div class="text-xs mt-1">
                    <span
                      class="px-2 py-0.5 rounded"
                      :class="getCoverageStatusClass(getShipmentById(shipmentId)?.coverageStatus)"
                    >
                      {{ getCoverageStatusLabel(getShipmentById(shipmentId)?.coverageStatus) }}
                    </span>
                  </div>
                </div>
                <button
                  @click="removeShipmentFromGroup(shipmentId)"
                  class="text-red-600 hover:text-red-800 p-1"
                  title="Удалить из группы"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500 text-center py-4">
              Нет выбранных поставок
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно выбора заказов -->
    <div
      v-if="showOrderSelector"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showOrderSelector = false"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Выберите заказы</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-2">
            <label
              v-for="order in allOrders"
              :key="order.id"
              class="flex items-center p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selectedGroup?.orderIds.includes(order.id!)"
                @change="toggleOrderInGroup(order.id!)"
                class="mr-3"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900">{{ order.orderNumber }}</div>
                <div class="text-xs text-gray-600">{{ formatDate(order.date) }}</div>
              </div>
            </label>
          </div>
        </div>
        <div class="p-6 border-t border-gray-200">
          <button
            @click="showOrderSelector = false"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Готово
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно выбора поставок -->
    <div
      v-if="showShipmentSelector"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showShipmentSelector = false"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Выберите поставки</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-2">
            <label
              v-for="shipment in allShipments"
              :key="shipment.id"
              class="flex items-center p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selectedGroup?.shipmentIds.includes(shipment.id!)"
                @change="toggleShipmentInGroup(shipment.id!)"
                class="mr-3"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900">
                  {{ shipment.supplyID || shipment.preorderID || `Поставка #${shipment.id}` }}
                </div>
                <div class="text-xs text-gray-600">{{ formatDate(shipment.createDate) }}</div>
                <div class="text-xs mt-1">
                  <span
                    class="px-2 py-0.5 rounded"
                    :class="getCoverageStatusClass(shipment.coverageStatus)"
                  >
                    {{ getCoverageStatusLabel(shipment.coverageStatus) }}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>
        <div class="p-6 border-t border-gray-200">
          <button
            @click="showShipmentSelector = false"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Plus, ArrowLeft, Trash2, X, Play } from 'lucide-vue-next'
import { db } from '../../db/db'

// Типы для групп поставок
interface ShipmentGroup {
  id?: number
  name: string
  date: string
  orderIds: number[]
  shipmentIds: number[]
  createdAt?: string
  updatedAt?: string
}

interface PurchaseOrder {
  id: number
  [key: string]: any
}

interface Supply {
  id: number
  [key: string]: any
}

const groups = ref<ShipmentGroup[]>([])
const selectedGroupId = ref<number | null>(null)
const showCreateForm = ref(false)
const isCreating = ref(false)
const isRunningDistribution = ref(false)
const showOrderSelector = ref(false)
const showShipmentSelector = ref(false)

const allOrders = ref<PurchaseOrder[]>([])
const allShipments = ref<Supply[]>([])

const newGroup = ref<Omit<ShipmentGroup, 'id' | 'orderIds' | 'shipmentIds' | 'createdAt' | 'updatedAt'>>({
  name: '',
  date: new Date().toISOString().split('T')[0],
})

const selectedGroup = computed(() => {
  if (!selectedGroupId.value) return null
  return groups.value.find(g => g.id === selectedGroupId.value)
})

const ordersSummary = ref({ totalQuantity: 0, totalSum: 0 })

const updateOrdersSummary = async () => {
  if (!selectedGroup.value || !selectedGroup.value.orderIds || selectedGroup.value.orderIds.length === 0) {
    ordersSummary.value = { totalQuantity: 0, totalSum: 0 }
    return
  }
  
  let totalQuantity = 0
  let totalSum = 0
  
  try {
    // Загружаем purchaseItems для выбранных заказов
    let purchaseItems: any[] = []
    if (db.purchaseItems) {
      purchaseItems = await db.purchaseItems.where('orderId').anyOf(selectedGroup.value.orderIds).toArray()
    }
    
    purchaseItems.forEach(item => {
      totalQuantity += item.quantity
      // Сумма = количество * себестоимость единицы
      totalSum += item.quantity * (item.unitCostResult || 0)
    })
  } catch (error) {
    console.error('Ошибка при расчете статистики заказов:', error)
    totalQuantity = 0
    totalSum = 0
  }
  
  ordersSummary.value = { totalQuantity, totalSum }
}

const shipmentsSummary = computed(() => {
  if (!selectedGroup.value) return { totalQuantity: 0, fullCoverage: 0, partialCoverage: 0, emptyCoverage: 0 }
  
  let totalQuantity = 0
  let fullCoverage = 0
  let partialCoverage = 0
  let emptyCoverage = 0
  
  selectedGroup.value.shipmentIds.forEach(shipmentId => {
    const shipment = allShipments.value.find(s => s.id === shipmentId)
    if (shipment) {
      totalQuantity += shipment.items?.reduce((sum, item) => sum + (item.acceptedQuantity || item.quantity), 0) || 0
      
      if (shipment.coverageStatus === 'full') {
        fullCoverage++
      } else if (shipment.coverageStatus === 'partial') {
        partialCoverage++
      } else {
        emptyCoverage++
      }
    }
  })
  
  return { totalQuantity, fullCoverage, partialCoverage, emptyCoverage }
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('ru-RU')
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(amount)
}

const getOrderById = (id: number): PurchaseOrder | undefined => {
  return allOrders.value.find(o => o.id === id)
}

const getShipmentById = (id: number): Supply | undefined => {
  return allShipments.value.find(s => s.id === id)
}

const getCoverageStatusClass = (status?: 'full' | 'partial' | 'empty') => {
  switch (status) {
    case 'full':
      return 'bg-green-100 text-green-800'
    case 'partial':
      return 'bg-yellow-100 text-yellow-800'
    case 'empty':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getCoverageStatusLabel = (status?: 'full' | 'partial' | 'empty') => {
  switch (status) {
    case 'full':
      return 'Полностью покрыто'
    case 'partial':
      return 'Частично покрыто'
    case 'empty':
      return 'Без покрытия'
    default:
      return 'Неизвестно'
  }
}

const loadGroups = async () => {
  try {
    // Проверяем существование таблицы перед использованием
    if (db.shipmentGroups) {
      const loadedGroups = await db.shipmentGroups.toArray()
      // Убеждаемся, что массивы всегда инициализированы
      groups.value = loadedGroups.map(group => ({
        ...group,
        orderIds: Array.isArray(group.orderIds) ? group.orderIds : [],
        shipmentIds: Array.isArray(group.shipmentIds) ? group.shipmentIds : [],
      }))
    } else {
      // Таблица не существует, инициализируем пустым массивом
      groups.value = []
    }
  } catch (error) {
    console.error('Ошибка при загрузке групп:', error)
    groups.value = []
  }
}

const loadOrders = async () => {
  try {
    if (db.purchaseOrders) {
      allOrders.value = await db.purchaseOrders.toArray()
    } else {
      allOrders.value = []
    }
  } catch (error) {
    console.error('Ошибка при загрузке заказов:', error)
    allOrders.value = []
  }
}

const loadShipments = async () => {
  try {
    if (db.shipments) {
      allShipments.value = await db.shipments.toArray()
    } else {
      allShipments.value = []
    }
  } catch (error) {
    console.error('Ошибка при загрузке поставок:', error)
    allShipments.value = []
  }
}

const handleCreateGroup = async () => {
  if (!newGroup.value.name || !newGroup.value.date) return
  
  isCreating.value = true
  try {
    const group: Omit<ShipmentGroup, 'id'> = {
      name: newGroup.value.name,
      date: newGroup.value.date,
      orderIds: [],
      shipmentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    if (db.shipmentGroups) {
      await db.shipmentGroups.add(group as ShipmentGroup)
      await loadGroups()
    } else {
      console.warn('Таблица shipmentGroups не существует')
    }
    showCreateForm.value = false
    newGroup.value = {
      name: '',
      date: new Date().toISOString().split('T')[0],
    }
  } catch (error) {
    console.error('Ошибка при создании группы:', error)
    alert('Ошибка при создании группы')
  } finally {
    isCreating.value = false
  }
}

const handleDeleteGroup = async (id: number) => {
  if (!confirm('Вы уверены, что хотите удалить эту группу?')) return
  
  try {
    if (db.shipmentGroups) {
      await db.shipmentGroups.delete(id)
      await loadGroups()
      if (selectedGroupId.value === id) {
        selectedGroupId.value = null
      }
    } else {
      console.warn('Таблица shipmentGroups не существует')
    }
  } catch (error) {
    console.error('Ошибка при удалении группы:', error)
    alert('Ошибка при удалении группы')
  }
}

const toggleOrderInGroup = async (orderId: number) => {
  if (!selectedGroup.value) return
  
  // Проверяем статус заказа перед добавлением
  const order = allOrders.value.find(o => o.id === orderId)
  if (order && order.status !== 'SHIPPED_TO_WB') {
    const statusLabel = getOrderStatusLabel(order.status)
    if (!confirm(`Этот заказ еще не отгружен на ВБ (статус: ${statusLabel}). Распределение себестоимости невозможно. Все равно добавить в группу?`)) {
      return
    }
  }
  
  // Убеждаемся, что массив инициализирован
  if (!Array.isArray(selectedGroup.value.orderIds)) {
    selectedGroup.value.orderIds = []
  }
  
  const currentOrderIds = selectedGroup.value.orderIds
  const index = currentOrderIds.indexOf(orderId)
  
  if (index >= 0) {
    currentOrderIds.splice(index, 1)
  } else {
    currentOrderIds.push(orderId)
  }
  
  await updateGroup()
}

const getOrderStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: 'Черновик',
    confirmed: 'Подтвержден',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    cancelled: 'Отменен',
    IN_CHINA: 'В Китае',
    IN_TRANSIT: 'Едет из Китая',
    AT_FULFILLMENT: 'На фулфилменте',
    SHIPPED_TO_WB: 'Отгружен на ВБ',
  }
  return labels[status] || status
}

const toggleShipmentInGroup = async (shipmentId: number) => {
  if (!selectedGroup.value) return
  
  // Убеждаемся, что массив инициализирован
  if (!Array.isArray(selectedGroup.value.shipmentIds)) {
    selectedGroup.value.shipmentIds = []
  }
  
  const currentShipmentIds = selectedGroup.value.shipmentIds
  const index = currentShipmentIds.indexOf(shipmentId)
  
  if (index >= 0) {
    currentShipmentIds.splice(index, 1)
  } else {
    currentShipmentIds.push(shipmentId)
  }
  
  await updateGroup()
}

const removeOrderFromGroup = async (orderId: number) => {
  if (!selectedGroup.value) return
  
  // Убеждаемся, что массив инициализирован
  if (!Array.isArray(selectedGroup.value.orderIds)) {
    selectedGroup.value.orderIds = []
  }
  
  const index = selectedGroup.value.orderIds.indexOf(orderId)
  if (index >= 0) {
    selectedGroup.value.orderIds.splice(index, 1)
    await updateGroup()
  }
}

const removeShipmentFromGroup = async (shipmentId: number) => {
  if (!selectedGroup.value) return
  
  // Убеждаемся, что массив инициализирован
  if (!Array.isArray(selectedGroup.value.shipmentIds)) {
    selectedGroup.value.shipmentIds = []
  }
  
  const index = selectedGroup.value.shipmentIds.indexOf(shipmentId)
  if (index >= 0) {
    selectedGroup.value.shipmentIds.splice(index, 1)
    await updateGroup()
  }
}

const updateGroup = async () => {
  if (!selectedGroup.value || !selectedGroup.value.id) return
  
  const groupId = selectedGroup.value.id
  // Убеждаемся, что массивы всегда определены
  const orderIds = Array.isArray(selectedGroup.value.orderIds) 
    ? [...selectedGroup.value.orderIds] 
    : []
  const shipmentIds = Array.isArray(selectedGroup.value.shipmentIds) 
    ? [...selectedGroup.value.shipmentIds] 
    : []
  
  try {
    const updateData: Partial<ShipmentGroup> = {
      orderIds: orderIds,
      shipmentIds: shipmentIds,
      updatedAt: new Date().toISOString(),
    }
    
    await db.shipmentGroups.update(groupId, updateData)
    
    // Перезагружаем группы
    await loadGroups()
    
    // Восстанавливаем выбранную группу
    selectedGroupId.value = groupId
    
    // Обновляем статистику
    await updateOrdersSummary()
  } catch (error) {
    console.error('Ошибка при обновлении группы:', error)
    console.error('Детали ошибки:', {
      groupId,
      orderIds,
      shipmentIds,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    alert('Ошибка при обновлении группы: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleRunDistribution = async () => {
  if (!selectedGroupId.value) return
  
  isRunningDistribution.value = true
  try {
    const supplyService = container.getSupplyService()
    await supplyService.calculateGroupFifo(selectedGroupId.value)
    
    // Перезагружаем поставки для обновления статусов покрытия
    await loadShipments()
    await loadGroups()
    
    alert('Распределение завершено успешно!')
  } catch (error) {
    console.error('Ошибка при запуске распределения:', error)
    alert('Ошибка при запуске распределения: ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    isRunningDistribution.value = false
  }
}

// Watch for selectedGroup changes to update summary
watch(selectedGroupId, async (newId) => {
  if (newId) {
    await updateOrdersSummary()
  }
}, { immediate: true })

onMounted(async () => {
  await loadGroups()
  await loadOrders()
  await loadShipments()
  await updateOrdersSummary()
})
</script>

