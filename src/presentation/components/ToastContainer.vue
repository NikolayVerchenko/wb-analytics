<template>
  <div class="toast-container fixed top-4 right-4 z-50 space-y-2">
    <TransitionGroup name="toast" tag="div">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-item flex items-start gap-3 p-4 rounded-lg shadow-lg max-w-md bg-white border-l-4"
        :class="getToastClass(toast.type)"
        @click="remove(toast.id)"
      >
        <component :is="getIcon(toast.type)" class="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-gray-900">{{ toast.title }}</div>
          <div v-if="toast.message" class="text-sm text-gray-600 mt-1">{{ toast.message }}</div>
        </div>
        <button
          @click.stop="remove(toast.id)"
          class="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import { toastService, type Toast } from '../services/ToastService'

const toasts = ref<Toast[]>([])
let unsubscribe: (() => void) | null = null

const getToastClass = (type: Toast['type']): string => {
  const classes = {
    success: 'border-green-500 bg-green-50',
    error: 'border-red-500 bg-red-50',
    warning: 'border-yellow-500 bg-yellow-50',
    info: 'border-blue-500 bg-blue-50',
  }
  return classes[type]
}

const getIcon = (type: Toast['type']) => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }
  return icons[type]
}

const remove = (id: string) => {
  toastService.remove(id)
}

onMounted(() => {
  toasts.value = toastService.getAll()
  unsubscribe = toastService.subscribe((newToasts) => {
    toasts.value = newToasts
  })
})

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
