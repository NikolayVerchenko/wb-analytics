<template>
  <div class="relative">
    <!-- Кнопка открытия модального окна -->
    <button
      @click="openModal"
      class="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      <Calendar class="w-3.5 h-3.5" />
      <span>{{ displayPeriod }}</span>
      <ChevronDown class="w-3.5 h-3.5" />
    </button>

    <!-- Модальное окно через Teleport -->
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
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeModal"
        >
          <!-- Overlay с размытием -->
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Модальное окно -->
          <div
            class="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col mx-4 md:mx-0"
            @click.stop
          >
            <!-- Заголовок -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Выбор периода</h3>
              <button
                @click="closeModal"
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Контент -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Сетка пресетов -->
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-3">Быстрый выбор</h4>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="preset in presets"
                    :key="preset.key"
                    @click="selectPreset(preset.key)"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                      selectedPreset === preset.key
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    {{ preset.label }}
                  </button>
                </div>
              </div>

              <!-- Выбор недели -->
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-3">Выбрать неделю</h4>
                <select
                  v-model="selectedWeek"
                  @change="handleWeekChange"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">-- Выберите неделю --</option>
                  <option
                    v-for="week in weeks"
                    :key="week.start"
                    :value="week.start + '_' + week.end"
                  >
                    {{ week.label }}
                  </option>
                </select>
              </div>

              <!-- Произвольный выбор -->
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-3">Произвольный период</h4>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">От:</label>
                    <input
                      v-model="customDateFrom"
                      type="date"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      @change="handleCustomDateChange"
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">До:</label>
                    <input
                      v-model="customDateTo"
                      type="date"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      @change="handleCustomDateChange"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer с кнопками -->
            <div class="p-4 border-t border-gray-200">
              <div class="flex gap-3">
                <button
                  @click="closeModal"
                  class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  @click="applyPeriod"
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Calendar, ChevronDown, X } from 'lucide-vue-next'
import { useAnalyticsStore } from '../../stores/analyticsStore'

const store = useAnalyticsStore()

const isOpen = ref(false)
const selectedPreset = ref<string | null>(null)
const selectedWeek = ref<string>('')
const customDateFrom = ref<string>('')
const customDateTo = ref<string>('')

// Локальные значения для модального окна
const tempDateFrom = ref<string>('')
const tempDateTo = ref<string>('')

// Тип для недели
type WeekOption = {
  label: string
  start: string
  end: string
}

// Пресеты периодов
const presets = [
  { key: 'thisWeek', label: 'Эта неделя' },
  { key: 'lastWeek', label: 'Прошлая неделя' },
  { key: 'last30', label: '30 дней' },
  { key: 'last90', label: '90 дней' },
  { key: 'thisMonth', label: 'Текущий месяц' },
]

// Функция для вычисления начала недели (понедельник)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0) // Обнуляем время сначала
  const day = d.getDay() // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  // Вычисляем количество дней до понедельника
  // Если день = 0 (воскресенье), отступаем на 6 дней назад → получаем понедельник
  // Если день = 1 (понедельник), отступаем на 0 дней → остаемся на понедельнике
  // Если день = 2 (вторник), отступаем на 1 день назад → получаем понедельник
  // Если день = 3 (среда), отступаем на 2 дня назад → получаем понедельник
  // Если день = 4 (четверг), отступаем на 3 дня назад → получаем понедельник
  // Если день = 5 (пятница), отступаем на 4 дня назад → получаем понедельник
  // Если день = 6 (суббота), отступаем на 5 дней назад → получаем понедельник
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// Функция для вычисления конца недели (воскресенье)
const getWeekEnd = (date: Date): Date => {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6) // Понедельник + 6 дней = Воскресенье
  return end
}

// Форматирование даты в YYYY-MM-DD с учетом локального времени (выносим выше для использования)
const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Функции для вычисления периодов
const getThisWeek = () => {
  const today = new Date()
  const start = getWeekStart(today)
  const end = getWeekEnd(today)
  return {
    from: formatDateToISO(start),
    to: formatDateToISO(end),
  }
}

const getLastWeek = () => {
  const today = new Date()
  const lastWeekStart = new Date(today)
  lastWeekStart.setDate(today.getDate() - 7)
  const start = getWeekStart(lastWeekStart)
  const end = getWeekEnd(lastWeekStart)
  return {
    from: formatDateToISO(start),
    to: formatDateToISO(end),
  }
}

const getLastNDays = (days: number) => {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - days)
  from.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return {
    from: formatDateToISO(from),
    to: formatDateToISO(today),
  }
}

const getThisMonth = () => {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return {
    from: formatDateToISO(start),
    to: formatDateToISO(end),
  }
}

// Функция для получения номера недели в году (ISO 8601)
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Форматирование даты для метки недели (ДД.ММ)
const formatDateForLabel = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

// Генерация массива недель для предыдущего года (данные обычно за прошлый год)
const generateWeeks = (): WeekOption[] => {
  const currentYear = new Date().getFullYear()
  const targetYear = currentYear - 1 // Генерируем недели для предыдущего года
  const weeks: WeekOption[] = []
  
  // Находим первый понедельник года
  const startOfYear = new Date(targetYear, 0, 1)
  startOfYear.setHours(0, 0, 0, 0)
  let firstMonday = getWeekStart(startOfYear)
  
  // Если понедельник оказался в прошлом году, берем следующий понедельник
  if (firstMonday.getFullYear() < targetYear) {
    firstMonday = new Date(firstMonday)
    firstMonday.setDate(firstMonday.getDate() + 7)
  }
  
  // Генерируем недели до конца года (включая недели, которые заканчиваются в следующем году)
  let currentWeekStart = new Date(firstMonday)
  
  // Генерируем недели, которые начинаются в целевом году
  while (currentWeekStart.getFullYear() <= targetYear + 1) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6) // Понедельник + 6 дней = Воскресенье
    weekEnd.setHours(23, 59, 59, 999)
    
    // Включаем только недели, которые начинаются в целевом году
    if (currentWeekStart.getFullYear() === targetYear) {
      const weekNumber = getWeekNumber(currentWeekStart)
      const startStr = formatDateToISO(currentWeekStart)
      const endStr = formatDateToISO(weekEnd)
      const startFormatted = formatDateForLabel(currentWeekStart)
      const endFormatted = formatDateForLabel(weekEnd)
      
      weeks.push({
        label: `Неделя ${weekNumber} (${startFormatted} - ${endFormatted})`,
        start: startStr,
        end: endStr,
      })
    }
    
    currentWeekStart = new Date(currentWeekStart)
    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    
    // Прекращаем, если прошли достаточно далеко в следующий год (январь следующего года)
    if (currentWeekStart.getFullYear() > targetYear + 1 || 
        (currentWeekStart.getFullYear() === targetYear + 1 && currentWeekStart.getMonth() > 0)) {
      break
    }
  }
  
  // Сортируем в обратном порядке (от самой свежей к старой)
  return weeks.reverse()
}

// Массив недель
const weeks = computed(() => generateWeeks())

// Выбор пресета
const selectPreset = (presetKey: string) => {
  selectedPreset.value = presetKey
  selectedWeek.value = ''
  let period

  switch (presetKey) {
    case 'thisWeek':
      period = getThisWeek()
      break
    case 'lastWeek':
      period = getLastWeek()
      break
    case 'last30':
      period = getLastNDays(30)
      break
    case 'last90':
      period = getLastNDays(90)
      break
    case 'thisMonth':
      period = getThisMonth()
      break
    default:
      return
  }

  tempDateFrom.value = period.from
  tempDateTo.value = period.to
  customDateFrom.value = period.from
  customDateTo.value = period.to
}

// Обработка изменения выбранной недели
const handleWeekChange = () => {
  if (selectedWeek.value) {
    const [start, end] = selectedWeek.value.split('_')
    tempDateFrom.value = start
    tempDateTo.value = end
    customDateFrom.value = start
    customDateTo.value = end
    selectedPreset.value = null
  }
}

// Обработка изменения кастомных дат
const handleCustomDateChange = () => {
  selectedPreset.value = null
  selectedWeek.value = ''
  tempDateFrom.value = customDateFrom.value
  tempDateTo.value = customDateTo.value
}

// Форматирование даты для отображения
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

// Отображаемый период на кнопке
const displayPeriod = computed(() => {
  const from = store.filters.dateFrom
  const to = store.filters.dateTo
  if (!from || !to) {
    return 'Выберите период'
  }
  return `${formatDate(from)} - ${formatDate(to)}`
})

// Открытие модального окна
const openModal = () => {
  // Инициализируем значения из store
  tempDateFrom.value = store.filters.dateFrom || ''
  tempDateTo.value = store.filters.dateTo || ''
  customDateFrom.value = store.filters.dateFrom || ''
  customDateTo.value = store.filters.dateTo || ''
  selectedPreset.value = null
  selectedWeek.value = ''

  isOpen.value = true
}

// Закрытие модального окна
const closeModal = () => {
  isOpen.value = false
}

// Применение периода
const applyPeriod = () => {
  if (tempDateFrom.value && tempDateTo.value) {
    store.setFilters(tempDateFrom.value, tempDateTo.value)
    closeModal()
  }
}

// Инициализация при монтировании
onMounted(() => {
  // Если фильтры не установлены, устанавливаем период по умолчанию: последний месяц
  if (!store.filters.dateFrom || !store.filters.dateTo) {
    const period = getLastNDays(30)
    store.setFilters(period.from, period.to)
  }
})
</script>

