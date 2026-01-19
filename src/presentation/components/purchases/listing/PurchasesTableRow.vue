<template>
  <tr
    @click="handleRowClick"
    class="hover:bg-gray-50 cursor-pointer transition-colors"
  >
    <td class="px-4 py-3 text-sm text-gray-900">
      <div>
        <div class="font-medium">{{ row.orderNumber }}</div>
        <div class="text-xs text-gray-500">Закупка</div>
      </div>
    </td>
    <td class="px-4 py-3 text-sm text-gray-900">
      {{ formatDate(row.date) }}
    </td>
    <td class="px-4 py-3 text-sm">
      <span
        class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
        :class="getStatusBadgeClass(row.status)"
      >
        {{ getStatusText(row.status) }}
      </span>
    </td>
    <td class="px-4 py-3 text-sm text-gray-600">
      {{ row.itemsCount }}
    </td>
    <td class="px-4 py-3 text-sm text-gray-600">
      {{ row.totalQuantity }}
    </td>
    <td class="px-4 py-3 text-sm font-medium text-gray-900">
      {{ formatCurrency(row.totalRUB) }}
    </td>
    <td class="px-4 py-3 text-sm">
      <div class="flex items-center gap-2">
        <button
          @click.stop="handleEdit"
          class="text-blue-600 hover:text-blue-800 transition-colors"
          title="Редактировать"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          @click.stop="handleDelete"
          class="text-red-600 hover:text-red-800 transition-colors"
          title="Удалить"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { PurchaseListRow } from '@/types/purchases'

const props = defineProps<{
  row: PurchaseListRow
}>()

const emit = defineEmits<{
  edit: [id: number]
  delete: [id: number]
}>()

const router = useRouter()

const handleRowClick = () => {
  router.push(`/purchases/${props.row.id}`)
}

const handleEdit = () => {
  router.push(`/purchases/${props.row.id}`)
}

const handleDelete = () => {
  emit('delete', props.row.id)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
  }).format(value)
}

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Ожидает',
    ordered: 'Заказано',
    shipped: 'Отправлено',
    received: 'Получено',
  }
  return statusMap[status] || status
}

const getStatusBadgeClass = (status: string): string => {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    ordered: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    received: 'bg-green-100 text-green-800',
  }
  return classMap[status] || 'bg-slate-100 text-slate-800'
}
</script>
