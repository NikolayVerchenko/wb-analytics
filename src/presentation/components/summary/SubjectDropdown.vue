<template>
  <div class="relative" ref="containerRef">
    <div
      ref="triggerRef"
      @click.stop="isOpen = !isOpen"
      tabindex="0"
      class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-72 cursor-pointer bg-white flex items-center justify-between"
      :class="{
        'border-blue-500': isOpen,
      }"
    >
      <span class="text-gray-700 truncate">
        {{ displayText }}
      </span>
      <svg
        class="w-4 h-4 text-gray-400 transition-transform"
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
    </div>

    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[400px] flex flex-col"
        @click.stop
        @mousedown.stop
      >
        <div class="p-3 border-b border-gray-200 flex-shrink-0">
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
              ref="searchInputRef"
              v-model="localSearch"
              type="text"
              placeholder="Поиск по предмету..."
              class="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @click.stop
            />
          </div>
        </div>

        <div class="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            @click.stop="handleSelectAll"
            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Выбрать все (видимые)
          </button>
          <button
            type="button"
            @click.stop="handleClearAll"
            class="text-xs text-gray-600 hover:text-gray-700 font-medium"
          >
            Снять все
          </button>
        </div>

        <div class="overflow-y-auto flex-1 min-h-0">
          <div v-if="filteredOptions.length === 0" class="p-4 text-center text-sm text-gray-500">
            Ничего не найдено
          </div>
          <div
            v-for="option in filteredOptions"
            :key="option.code"
            @click.stop="handleToggle(option.code)"
            class="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
          >
            <input
              type="checkbox"
              :checked="isSelected(option.code)"
              @change.stop="handleToggle(option.code)"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">{{ option.code }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

interface Option {
  code: string
}

interface Props {
  modelValue: string[]
  options: Option[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Фильтр по предмету',
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const localSearch = ref('')
const debouncedSearch = ref('')

let searchTimer: number | null = null

watch(
  localSearch,
  (newSearch) => {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = window.setTimeout(() => {
      debouncedSearch.value = newSearch
    }, 300)
  },
  { immediate: true }
)

const displayText = computed(() => {
  if (props.modelValue.length === 0) {
    return props.placeholder
  }
  return `Выбрано: ${props.modelValue.length}`
})

const filteredOptions = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (!query) {
    return props.options
  }

  return props.options.filter((option) => option.code.toLowerCase().includes(query))
})

const isSelected = (code: string): boolean => {
  return props.modelValue.includes(code)
}

const handleToggle = (code: string) => {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(code)
  if (index > -1) {
    newValue.splice(index, 1)
  } else {
    newValue.push(code)
  }
  emit('update:modelValue', newValue)
}

const handleSelectAll = () => {
  const visibleCodes = filteredOptions.value.map((opt) => opt.code)
  const newValue = [...new Set([...props.modelValue, ...visibleCodes])]
  emit('update:modelValue', newValue)
}

const handleClearAll = () => {
  emit('update:modelValue', [])
}

watch(isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

const handleClickOutside = (event: MouseEvent) => {
  nextTick(() => {
    if (!isOpen.value) {
      return
    }

    const target = event.target as Node | null
    if (target && containerRef.value && !containerRef.value.contains(target)) {
      isOpen.value = false
    }
  })
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
})
</script>
