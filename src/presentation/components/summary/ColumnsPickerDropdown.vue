<template>
  <div class="relative" ref="containerRef">
    <!-- Кнопка открытия dropdown -->
    <button
      type="button"
      @click.stop="isOpen = !isOpen"
      class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center gap-2"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
      Колонки
      <svg
        class="w-3.5 h-3.5 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 flex flex-col"
        @click.stop
      >
        <!-- Заголовок и поиск -->
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-900">Настройка колонок</h3>
            <button
              type="button"
              @click="handleReset"
              class="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Сбросить
            </button>
          </div>
          <div class="relative">
            <svg
              class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск колонок..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keydown.esc="isOpen = false"
            />
          </div>
        </div>

        <!-- Список колонок -->
        <div 
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto p-2 max-h-[360px]"
        >
          <div class="space-y-1">
            <!-- Обычные строки -->
            <div
              v-for="column in filteredColumns"
              :key="column.id"
              class="flex items-center px-3 py-2 rounded-md hover:bg-gray-50"
            >
              <!-- Checkbox -->
              <input
                type="checkbox"
                :checked="visibleColumnIds.includes(column.id)"
                @change="handleToggle(column.id)"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              
              <!-- Label -->
              <span class="ml-3 text-sm text-gray-700 flex-1 select-none">{{ column.label }}</span>
            </div>
          </div>
          
          <div v-if="filteredColumns.length === 0" class="px-3 py-8 text-center text-sm text-gray-500">
            Колонки не найдены
          </div>
        </div>

        <!-- Футер с кнопкой и счетчиками -->
        <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span class="text-xs text-gray-600">
            Выбрано: {{ visibleColumnIds.length }} из {{ allColumns.length }}
          </span>
          <button
            type="button"
            @click="handleOpenReorderModal"
            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Настроить порядок колонок
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { ColumnDef } from '../../summary/summaryColumns'

interface Props {
  allColumns: ColumnDef<any, any>[]
  visibleColumnIds: string[]
  columnOrder: string[]
}

interface Emits {
  (e: 'update:visibleColumnIds', ids: string[]): void
  (e: 'reset'): void
  (e: 'open-reorder-modal'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)

// Map колонок по ID для быстрого доступа
const columnById = computed(() => {
  const map = new Map<string, ColumnDef<any, any>>()
  props.allColumns.forEach(col => map.set(col.id, col))
  return map
})

// Колонки в порядке columnOrder
const orderedColumns = computed(() => {
  return props.columnOrder
    .map(id => columnById.value.get(id))
    .filter((col): col is ColumnDef<any, any> => col !== undefined)
})

// Фильтрация колонок по поисковому запросу (в порядке columnOrder)
const filteredColumns = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return orderedColumns.value
  }
  return orderedColumns.value.filter(col =>
    col.label.toLowerCase().includes(query) ||
    col.id.toLowerCase().includes(query)
  )
})

// Обработка переключения колонки
const handleToggle = (columnId: string) => {
  const newIds = props.visibleColumnIds.includes(columnId)
    ? props.visibleColumnIds.filter(id => id !== columnId)
    : [...props.visibleColumnIds, columnId]
  emit('update:visibleColumnIds', newIds)
}

// Открыть модалку для изменения порядка
const handleOpenReorderModal = () => {
  isOpen.value = false
  emit('open-reorder-modal')
}

// Обработка сброса
const handleReset = () => {
  emit('reset')
  searchQuery.value = ''
}

// Закрытие по клику вне элемента
const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
