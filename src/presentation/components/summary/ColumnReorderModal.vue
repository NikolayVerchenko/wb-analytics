<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-end pr-4 pt-4"
        @click.self="handleClose"
      >
        <!-- Backdrop с прозрачностью только сверху -->
        <div class="fixed inset-0 bg-black bg-opacity-30 pointer-events-none" />
        
        <!-- Модалка -->
        <div
          class="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col relative z-10"
          @click.stop
        >
          <!-- Заголовок -->
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Управление колонками</h2>
            <button
              type="button"
              @click="handleClose"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Компактная подсказка -->
          <div class="px-6 py-2 bg-blue-50 border-b border-blue-100">
            <p class="text-xs text-blue-800">
              Перетащите за <span class="inline-block font-semibold">≡</span> для изменения порядка
            </p>
          </div>

          <!-- Список колонок -->
          <div
            ref="scrollContainerRef"
            class="flex-1 overflow-y-auto p-4 relative"
          >
            <div class="space-y-0 relative">
              <!-- Обычные строки -->
              <div
                v-for="(column, index) in orderedColumns"
                :key="column.id"
                :style="getRowStyle(index, column.id)"
                :class="{
                  'opacity-0': dragging.dragId === column.id,
                }"
                class="flex items-center px-4 py-3 rounded-md hover:bg-gray-50 transition-transform duration-150 ease-out"
              >
                <!-- Drag handle -->
                <div
                  v-if="!isColumnLocked(column.id)"
                  data-drag-handle
                  @pointerdown.stop.prevent="handleHandlePointerDown($event, column.id, index)"
                  class="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mr-3 select-none touch-none"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>
                <div v-else class="w-5 h-5 mr-3"></div>
                
                <!-- Название колонки -->
                <span
                  :class="{
                    'text-gray-400': isColumnLocked(column.id),
                    'text-gray-700': !isColumnLocked(column.id),
                  }"
                  class="text-sm flex-1 select-none"
                >
                  {{ column.label }}
                </span>
                
                <!-- Индикатор заблокированной колонки -->
                <span
                  v-if="isColumnLocked(column.id)"
                  class="text-xs text-gray-400 ml-2"
                >
                  (зафиксирована)
                </span>
              </div>

              <!-- Placeholder (щель для вставки) -->
              <div
                v-if="dragging.dragId && dragging.overIndex !== dragging.dragStartIndex"
                :style="getPlaceholderStyle()"
                class="absolute left-4 right-4 h-12 border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-md pointer-events-none"
              />

              <!-- Floating dragged row -->
              <div
                v-if="dragging.dragId"
                :style="getFloatingRowStyle()"
                class="absolute left-4 right-4 h-12 flex items-center px-4 bg-white shadow-lg ring-2 ring-blue-500 rounded-md pointer-events-none z-50"
              >
                <div class="text-gray-400 mr-3">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>
                <span class="text-sm text-gray-700 flex-1 select-none">
                  {{ getDraggedColumnLabel() }}
                </span>
              </div>
            </div>
          </div>

          <!-- Футер с кнопками -->
          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              Отмена
            </button>
            <button
              type="button"
              @click="handleConfirm"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Применить
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Teleport } from 'vue'
import type { ColumnDef } from '../../summary/summaryColumns'

interface Props {
  isOpen: boolean
  allColumns: ColumnDef<any, any>[]
  columnOrder: string[]
  visibleColumnIds: string[]
  lockedColumns?: string[]
}

interface Emits {
  (e: 'close'): void
  (e: 'confirm', newOrder: string[]): void
  (e: 'update:draft-order', newOrder: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  lockedColumns: () => ['product'],
})

const emit = defineEmits<Emits>()

const scrollContainerRef = ref<HTMLElement | null>(null)

// Draft-модель: локальная копия порядка для редактирования
const draftOrder = ref<string[]>([])

// Pointer-based drag состояние
const dragging = ref<{
  dragId: string | null
  dragStartIndex: number
  overIndex: number
  startY: number
  startScrollTop: number
  currentY: number
  rowHeight: number
}>({
  dragId: null,
  dragStartIndex: -1,
  overIndex: -1,
  startY: 0,
  startScrollTop: 0,
  currentY: 0,
  rowHeight: 48,
})

// Map колонок по ID
const columnById = computed(() => {
  const map = new Map<string, ColumnDef<any, any>>()
  props.allColumns.forEach(col => map.set(col.id, col))
  return map
})

// Колонки в порядке draftOrder
const orderedColumns = computed(() => {
  return draftOrder.value
    .map(id => columnById.value.get(id))
    .filter((col): col is ColumnDef<any, any> => col !== undefined)
})

// Проверка, заблокирована ли колонка
const isColumnLocked = (columnId: string): boolean => {
  return props.lockedColumns.includes(columnId)
}

// Инициализация draft при открытии модалки
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Копируем текущий порядок в draft
    // Важно: props.columnOrder содержит ВСЕ колонки (включая скрытые)
    // draftOrder должен содержать полный список для правильного сохранения порядка
    draftOrder.value = [...props.columnOrder]
  } else {
    // Сбрасываем состояние drag при закрытии
    dragging.value = {
      dragId: null,
      dragStartIndex: -1,
      overIndex: -1,
      startY: 0,
      startScrollTop: 0,
      currentY: 0,
      rowHeight: 48,
    }
  }
}, { immediate: true })

// Pointer-based drag обработчики
const handleHandlePointerDown = (event: PointerEvent, columnId: string, index: number) => {
  if (isColumnLocked(columnId)) return
  
  event.preventDefault()
  event.stopPropagation()
  
  const startScrollTop = scrollContainerRef.value?.scrollTop || 0
  
  dragging.value = {
    dragId: columnId,
    dragStartIndex: index,
    overIndex: index,
    startY: event.clientY,
    startScrollTop: startScrollTop,
    currentY: event.clientY,
    rowHeight: 48,
  }
  
  const target = event.currentTarget as HTMLElement
  if (target) {
    try {
      target.setPointerCapture(event.pointerId)
    } catch (e) {
      // Игнорируем ошибки capture
    }
  }
  
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
  
  document.addEventListener('pointermove', handlePointerMove, { passive: false })
  document.addEventListener('pointerup', handlePointerUp, { passive: false })
}

const handlePointerMove = (event: PointerEvent) => {
  if (!dragging.value.dragId || !scrollContainerRef.value) return
  
  event.preventDefault()
  
  const currentScrollTop = scrollContainerRef.value.scrollTop
  const deltaY = (event.clientY - dragging.value.startY) + (currentScrollTop - dragging.value.startScrollTop)
  
  const rawIndex = Math.floor((dragging.value.dragStartIndex * dragging.value.rowHeight + deltaY + dragging.value.rowHeight / 2) / dragging.value.rowHeight)
  
  const clampedIndex = Math.max(
    0,
    Math.min(rawIndex, orderedColumns.value.length - 1)
  )
  
  // Пропускаем заблокированные колонки
  let finalIndex = clampedIndex
  const draggedCol = orderedColumns.value[dragging.value.dragStartIndex]
  if (draggedCol && isColumnLocked(orderedColumns.value[finalIndex]?.id)) {
    if (finalIndex > dragging.value.dragStartIndex) {
      for (let i = finalIndex; i < orderedColumns.value.length; i++) {
        if (!isColumnLocked(orderedColumns.value[i]?.id)) {
          finalIndex = i
          break
        }
      }
    } else {
      for (let i = finalIndex; i >= 0; i--) {
        if (!isColumnLocked(orderedColumns.value[i]?.id)) {
          finalIndex = i
          break
        }
      }
    }
  }
  
  dragging.value.overIndex = finalIndex
  dragging.value.currentY = event.clientY
  
  // Автоскролл
  const container = scrollContainerRef.value
  const rect = container.getBoundingClientRect()
  const scrollThreshold = 60
  const scrollSpeed = 10
  
  if (event.clientY - rect.top < scrollThreshold) {
    container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed)
  } else if (rect.bottom - event.clientY < scrollThreshold) {
    container.scrollTop = Math.min(
      container.scrollHeight - container.clientHeight,
      container.scrollTop + scrollSpeed
    )
  }
}

const handlePointerUp = (event: PointerEvent) => {
  if (!dragging.value.dragId) return
  
  event.preventDefault()
  event.stopPropagation()
  
  try {
    const allHandles = document.querySelectorAll('[data-drag-handle]')
    allHandles.forEach(handle => {
      if (handle instanceof HTMLElement && handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId)
      }
    })
  } catch (e) {
    // Игнорируем ошибки
  }
  
  // Применяем перестановку в draftOrder
  if (dragging.value.overIndex !== dragging.value.dragStartIndex) {
    const newOrder = [...draftOrder.value]
    const [moved] = newOrder.splice(dragging.value.dragStartIndex, 1)
    newOrder.splice(dragging.value.overIndex, 0, moved)
    draftOrder.value = newOrder
    // Эмитим изменение для применения к таблице в реальном времени
    emit('update:draft-order', [...newOrder])
  }
  
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)
  
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  
  dragging.value = {
    dragId: null,
    dragStartIndex: -1,
    overIndex: -1,
    startY: 0,
    startScrollTop: 0,
    currentY: 0,
    rowHeight: 48,
  }
}

// Получить смещение для строки
const getRowOffset = (index: number): number => {
  if (!dragging.value.dragId) return 0
  if (index === dragging.value.dragStartIndex) return 0
  
  const dragStartIdx = dragging.value.dragStartIndex
  const overIdx = dragging.value.overIndex
  
  if (overIdx > dragStartIdx) {
    if (index > dragStartIdx && index <= overIdx) {
      return -dragging.value.rowHeight
    }
  } else if (overIdx < dragStartIdx) {
    if (index >= overIdx && index < dragStartIdx) {
      return dragging.value.rowHeight
    }
  }
  
  return 0
}

const getRowStyle = (index: number, columnId: string) => {
  const offset = getRowOffset(index)
  if (offset === 0) return {}
  return {
    transform: `translateY(${offset}px)`,
  }
}

const getPlaceholderStyle = () => {
  if (!dragging.value.dragId) return {}
  return {
    top: `${dragging.value.overIndex * dragging.value.rowHeight + 16}px`,
  }
}

const getFloatingRowStyle = () => {
  if (!dragging.value.dragId || !scrollContainerRef.value) return {}
  
  const currentScrollTop = scrollContainerRef.value.scrollTop
  const deltaY = (dragging.value.currentY - dragging.value.startY) + (currentScrollTop - dragging.value.startScrollTop)
  const baseTop = dragging.value.dragStartIndex * dragging.value.rowHeight + 16
  
  return {
    top: `${baseTop}px`,
    transform: `translateY(${deltaY}px)`,
  }
}

const getDraggedColumnLabel = () => {
  if (!dragging.value.dragId) return ''
  const column = orderedColumns.value.find(col => col.id === dragging.value.dragId)
  return column?.label || ''
}

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  // Эмитим только confirm, без close
  // Закрытие модалки будет выполнено в родительском компоненте после успешного сохранения
  emit('confirm', [...draftOrder.value])
}

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)
})
</script>
