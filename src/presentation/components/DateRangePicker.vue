<template>
  <div class="relative">
    <!-- Кнопка открытия -->
    <button
      data-date-picker-button
      @click.stop="toggleDropdown"
      class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      <Calendar class="w-4 h-4" />
      <span>{{ displayText }}</span>
      <ChevronDown :class="{ 'rotate-180': isOpen }" class="w-4 h-4 transition-transform" />
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        v-click-outside="closeDropdown"
        class="absolute z-50 mt-2 w-[600px] bg-white rounded-lg shadow-lg border border-gray-200 p-4"
        @click.stop
      >
        <div class="grid grid-cols-2 gap-4">
          <!-- Левая колонка: Пресеты и недели -->
          <div class="space-y-4">
            <!-- Пресеты -->
            <div>
              <h3 class="text-sm font-semibold text-gray-900 mb-2">Пресеты</h3>
              <div class="space-y-1">
                <button
                  v-for="preset in presets"
                  :key="preset.label"
                  @click="selectPreset(preset)"
                  class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors"
                  :class="{
                    'bg-blue-50 text-blue-600 font-medium': isSelectedPreset(preset),
                    'text-gray-700': !isSelectedPreset(preset),
                  }"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <!-- Недели -->
            <div>
              <h3 class="text-sm font-semibold text-gray-900 mb-2">Недели</h3>
              <select
                v-model="selectedWeek"
                @change="selectWeek"
                @click.stop
                @mousedown.stop
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Выберите неделю</option>
                <option
                  v-for="week in availableWeeks"
                  :key="`${week.year}-${week.weekNumber}`"
                  :value="`${week.year}-${week.weekNumber}`"
                >
                  {{ week.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- Правая колонка: Произвольный диапазон -->
          <div>
            <h3 class="text-sm font-semibold text-gray-900 mb-2">Произвольный период</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Дата начала
                </label>
                <input
                  v-model="customStart"
                  type="date"
                  :min="minDate"
                  :max="today"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  @change="updateCustomRange"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Дата окончания
                </label>
                <input
                  v-model="customEnd"
                  type="date"
                  :min="customStart || minDate"
                  :max="today"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  @change="updateCustomRange"
                />
              </div>
              <button
                @click="applyCustomRange"
                :disabled="!canApplyCustomRange"
                class="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Применить
              </button>
              <div v-if="validationError" class="text-xs text-red-600">
                {{ validationError }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Calendar, ChevronDown } from 'lucide-vue-next'
// TODO: Восстановить после реализации filterStore
// import { useFilterStore } from '../stores/filterStore'
import type { DateRange } from '@core/services/DateRangeService'

// TODO: Восстановить после реализации filterStore
// const filterStore = useFilterStore()
// Временная заглушка для filterStore
const filterStore = {
  currentDateRange: null as DateRange | null,
  dateRangeService: {
    getToday: () => new Date().toISOString().split('T')[0],
    getMinDate: () => '2024-01-29',
    getAvailableWeeks: () => [] as any[],
    getLast30Days: () => ({ start: '', end: '', label: 'Последние 30 дней' }) as DateRange,
    getLast90Days: () => ({ start: '', end: '', label: 'Последние 90 дней' }) as DateRange,
    getCurrentYear: () => ({ start: '', end: '', label: 'Текущий год' }) as DateRange,
    formatRange: (range: DateRange) => range.label || `${range.start} - ${range.end}`,
    getWeekRange: () => null as DateRange | null,
    validateRange: () => ({ valid: true, error: null }),
    getCustomRange: (start: string, end: string) => ({ start, end, label: '' }) as DateRange,
    isPreset: () => false,
  },
  setDateRange: (range: DateRange) => {
    console.log('setDateRange called (stub):', range)
  },
}

const isOpen = ref(false)
const selectedWeek = ref('')
const customStart = ref('')
const customEnd = ref('')
const validationError = ref('')

const today = computed(() => filterStore.dateRangeService.getToday())
const minDate = computed(() => filterStore.dateRangeService.getMinDate())
const availableWeeks = computed(() => filterStore.dateRangeService.getAvailableWeeks())

// Пресеты
const presets = computed(() => [
  filterStore.dateRangeService.getLast30Days(),
  filterStore.dateRangeService.getLast90Days(),
  filterStore.dateRangeService.getCurrentYear(),
])

const displayText = computed(() => {
  if (filterStore.currentDateRange) {
    return filterStore.dateRangeService.formatRange(filterStore.currentDateRange)
  }
  return 'Выберите период'
})

const canApplyCustomRange = computed(() => {
  return customStart.value && customEnd.value
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
  validationError.value = ''
}

const isSelectedPreset = (preset: DateRange): boolean => {
  if (!filterStore.currentDateRange || !preset.label) return false
  return (
    filterStore.currentDateRange.start === preset.start &&
    filterStore.currentDateRange.end === preset.end
  )
}

const selectPreset = (preset: DateRange) => {
  filterStore.setDateRange(preset)
  selectedWeek.value = ''
  customStart.value = ''
  customEnd.value = ''
  validationError.value = ''
  closeDropdown()
}

const selectWeek = () => {
  if (!selectedWeek.value) return

  const [yearStr, weekNumberStr] = selectedWeek.value.split('-')
  const year = parseInt(yearStr, 10)
  const weekNumber = parseInt(weekNumberStr, 10)

  const weekRange = filterStore.dateRangeService.getWeekRange(weekNumber, year)
  if (weekRange) {
    filterStore.setDateRange(weekRange)
    customStart.value = ''
    customEnd.value = ''
    validationError.value = ''
    // Закрываем dropdown с небольшой задержкой, чтобы пользователь увидел выбор
    setTimeout(() => {
      closeDropdown()
    }, 100)
  }
}

const updateCustomRange = () => {
  validationError.value = ''
}

const applyCustomRange = () => {
  if (!customStart.value || !customEnd.value) {
    validationError.value = 'Выберите обе даты'
    return
  }

  const validation = filterStore.dateRangeService.validateRange(customStart.value, customEnd.value)
  if (!validation.valid) {
    validationError.value = validation.error || 'Некорректный диапазон дат'
    return
  }

  const range = filterStore.dateRangeService.getCustomRange(customStart.value, customEnd.value)
  filterStore.setDateRange(range)
  selectedWeek.value = ''
  validationError.value = ''
  closeDropdown()
}

// Директива для закрытия при клике вне компонента
const vClickOutside = {
  mounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }, binding: any) {
    el.clickOutsideEvent = (event: MouseEvent) => {
      // Проверяем, что клик был вне элемента
      const target = event.target as Node | null
      if (!target) return
      
      // Проверяем, что клик не внутри dropdown
      if (el.contains(target)) return
      
      // Проверяем, что клик не на кнопке открытия
      const rootElement = el.closest('.relative')
      if (rootElement) {
        const button = rootElement.querySelector('[data-date-picker-button]') as HTMLElement
        if (button && button.contains(target)) return
      }
      
      // Проверяем, что клик не на select (чтобы dropdown не закрывался при выборе недели)
      const selectElement = el.querySelector('select')
      if (selectElement && (selectElement.contains(target) || target === selectElement)) return
      
      // Закрываем dropdown только если клик действительно вне компонента
      binding.value()
    }
    // Используем небольшую задержку, чтобы избежать закрытия при открытии
    setTimeout(() => {
      document.addEventListener('mousedown', el.clickOutsideEvent!)
    }, 100)
  },
  unmounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('mousedown', el.clickOutsideEvent)
    }
  },
}

onMounted(() => {
  // Инициализируем произвольный диапазон текущим значением, если это не пресет
  if (filterStore.currentDateRange && !filterStore.dateRangeService.isPreset(filterStore.currentDateRange)) {
    customStart.value = filterStore.currentDateRange.start
    customEnd.value = filterStore.currentDateRange.end
  }
})
</script>

