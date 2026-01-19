<template>
  <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Номер и тип
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Дата
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Статус
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Товаров
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Кол-во
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Сумма
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Действия
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <PurchasesTableRow
            v-for="row in rows"
            :key="row.id"
            :row="row"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PurchaseListRow } from '@/types/purchases'
import PurchasesTableRow from './PurchasesTableRow.vue'

defineProps<{
  rows: PurchaseListRow[]
}>()

defineEmits<{
  edit: [id: number]
  delete: [id: number]
}>()
</script>
