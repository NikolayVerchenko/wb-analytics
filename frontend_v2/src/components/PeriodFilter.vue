<template>
  <div class="period-filter">
    <button ref="triggerRef" type="button" class="period-trigger" @click="toggleOpen">
      <span>{{ periodLabel }}</span>
      <span class="period-trigger-icon">▦</span>
    </button>

    <div v-if="isOpen" ref="popoverRef" class="period-popover" :style="popoverStyle">
      <div class="period-calendar-layout">
        <div class="period-calendars">
          <div class="period-months-nav">
            <button type="button" class="period-nav-button" @click="shiftMonths(-1)">←</button>
            <div class="period-nav-year">{{ leftMonthYear }}</div>
            <button type="button" class="period-nav-button" @click="shiftMonths(1)">→</button>
          </div>

          <div class="period-months-grid">
            <section v-for="month in visibleMonths" :key="month.key" class="period-month-card">
              <h4 class="period-month-title">{{ month.label }}</h4>

              <div class="period-weekdays">
                <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
              </div>

              <div class="period-days-grid">
                <button
                  v-for="day in month.days"
                  :key="day.key"
                  type="button"
                  class="period-day"
                  :class="{
                    'period-day-outside': !day.isCurrentMonth,
                    'period-day-start': isRangeStart(day.value),
                    'period-day-end': isRangeEnd(day.value),
                    'period-day-in-range': isInRange(day.value),
                  }"
                  @click="selectDay(day.value)"
                  @mouseenter="setHoveredDate(day.value)"
                >
                  {{ day.dayNumber }}
                </button>
              </div>
            </section>
          </div>
        </div>

        <aside class="period-sidebar">
          <div class="period-presets">
            <button
              v-for="option in presetOptions"
              :key="option.value"
              type="button"
              class="period-preset-button"
              @click="applyPreset(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="period-fields">
            <div class="period-field">
              <label for="period-date-from">Начало периода</label>
              <input id="period-date-from" v-model="draft.date_from" type="date" />
            </div>

            <div class="period-field">
              <label for="period-date-to">Конец периода</label>
              <input id="period-date-to" v-model="draft.date_to" type="date" />
            </div>
          </div>

          <div class="period-actions">
            <button type="button" class="period-secondary-button" @click="resetDraft">Сбросить</button>
            <button type="button" class="period-primary-button" @click="savePeriod">Сохранить</button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

type PeriodPreset = 'week' | 'two_weeks' | 'month' | 'quarter' | 'year'

type PeriodRange = {
  date_from: string
  date_to: string
}

type CalendarDay = {
  key: string
  value: string
  dayNumber: number
  isCurrentMonth: boolean
}

const monthNames = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

const props = defineProps<{
  dateFrom: string
  dateTo: string
}>()

const emit = defineEmits<{
  apply: [PeriodRange]
}>()

const isOpen = ref(false)
const hoveredDate = ref('')
const displayedMonth = ref(getMonthStart(parseDateValue(props.dateFrom) ?? new Date()))
const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

const draft = reactive<PeriodRange>({
  date_from: props.dateFrom,
  date_to: props.dateTo,
})

const presetOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'week', label: 'Неделя' },
  { value: 'two_weeks', label: '2 недели' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
]

const periodLabel = computed(() => `${formatDisplayDate(props.dateFrom)} - ${formatDisplayDate(props.dateTo)}`)

const visibleMonths = computed(() => {
  const first = getMonthStart(displayedMonth.value)
  const second = addMonths(first, 1)

  return [createMonthView(first), createMonthView(second)]
})

const leftMonthYear = computed(() => String(displayedMonth.value.getFullYear()))

watch(
  () => [props.dateFrom, props.dateTo],
  ([dateFrom, dateTo]) => {
    draft.date_from = dateFrom
    draft.date_to = dateTo
    displayedMonth.value = getMonthStart(parseDateValue(dateFrom) ?? new Date())
    hoveredDate.value = ''
  },
)

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return
  }

  removePopoverListeners()
})

onBeforeUnmount(() => {
  removePopoverListeners()
})

function removePopoverListeners() {
  window.removeEventListener('resize', updatePopoverPosition)
  window.removeEventListener('scroll', updatePopoverPosition, true)
}

function updatePopoverPosition() {
  const trigger = triggerRef.value
  if (!trigger) {
    return
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const margin = 16
  const desiredWidth = 620
  const width = Math.min(desiredWidth, Math.max(320, viewportWidth - margin * 2))
  const rect = trigger.getBoundingClientRect()
  const left = Math.min(Math.max(margin, rect.right - width), viewportWidth - width - margin)
  const top = Math.min(rect.bottom + 8, viewportHeight - margin)
  const maxHeight = Math.max(240, viewportHeight - top - margin)

  popoverStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxWidth: `calc(100vw - ${margin * 2}px)`,
    maxHeight: `${maxHeight}px`,
  }
}

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function shiftMonths(offset: number) {
  displayedMonth.value = addMonths(displayedMonth.value, offset)
}

function resetDraft() {
  draft.date_from = props.dateFrom
  draft.date_to = props.dateTo
  displayedMonth.value = getMonthStart(parseDateValue(props.dateFrom) ?? new Date())
  hoveredDate.value = ''
}

function savePeriod() {
  if (!draft.date_from) {
    return
  }

  const dateTo = draft.date_to || draft.date_from

  emit('apply', {
    date_from: draft.date_from,
    date_to: dateTo,
  })

  isOpen.value = false
  hoveredDate.value = ''
}

function applyPreset(preset: PeriodPreset) {
  const range = getPresetRange(preset)
  draft.date_from = range.date_from
  draft.date_to = range.date_to
  displayedMonth.value = getMonthStart(parseDateValue(range.date_from) ?? new Date())
  hoveredDate.value = ''
}

function selectDay(value: string) {
  hoveredDate.value = ''

  if (!draft.date_from || draft.date_to) {
    draft.date_from = value
    draft.date_to = ''
    return
  }

  if (value < draft.date_from) {
    draft.date_to = draft.date_from
    draft.date_from = value
    return
  }

  draft.date_to = value
}

function setHoveredDate(value: string) {
  if (!draft.date_from || draft.date_to) {
    hoveredDate.value = ''
    return
  }

  hoveredDate.value = value
}

function isRangeStart(value: string): boolean {
  return draft.date_from === value
}

function isRangeEnd(value: string): boolean {
  return draft.date_to === value
}

function isInRange(value: string): boolean {
  if (!draft.date_from) {
    return false
  }

  if (draft.date_to) {
    return value >= draft.date_from && value <= draft.date_to
  }

  if (hoveredDate.value) {
    const start = draft.date_from < hoveredDate.value ? draft.date_from : hoveredDate.value
    const end = draft.date_from > hoveredDate.value ? draft.date_from : hoveredDate.value
    return value >= start && value <= end
  }

  return value === draft.date_from
}

function getPresetRange(preset: PeriodPreset): PeriodRange {
  const today = new Date()
  const dateTo = toDateInputValue(today)
  const dateFrom = new Date(today)

  if (preset === 'week') {
    dateFrom.setDate(today.getDate() - 6)
  }

  if (preset === 'two_weeks') {
    dateFrom.setDate(today.getDate() - 13)
  }

  if (preset === 'month') {
    dateFrom.setMonth(today.getMonth() - 1)
  }

  if (preset === 'quarter') {
    dateFrom.setMonth(today.getMonth() - 3)
  }

  if (preset === 'year') {
    dateFrom.setFullYear(today.getFullYear() - 1)
  }

  return {
    date_from: toDateInputValue(dateFrom),
    date_to: dateTo,
  }
}

function createMonthView(monthDate: Date) {
  return {
    key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
    label: monthNames[monthDate.getMonth()],
    days: buildMonthDays(monthDate),
  }
}

function buildMonthDays(monthDate: Date): CalendarDay[] {
  const monthStart = getMonthStart(monthDate)
  const startWeekday = (monthStart.getDay() + 6) % 7
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - startWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const dayDate = new Date(gridStart)
    dayDate.setDate(gridStart.getDate() + index)

    return {
      key: toDateInputValue(dayDate),
      value: toDateInputValue(dayDate),
      dayNumber: dayDate.getDate(),
      isCurrentMonth: dayDate.getMonth() === monthStart.getMonth(),
    }
  })
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function parseDateValue(value: string): Date | null {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value: string): string {
  if (!value) {
    return '-'
  }

  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }

  return `${day}.${month}.${year}`
}
</script>

<style scoped>
.period-filter {
  position: relative;
}

.period-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 220px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
}

.period-trigger-icon {
  color: #9ca3af;
  font-size: 14px;
}

.period-popover {
  position: fixed;
  z-index: 40;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  overflow: auto;
}

.period-calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
}

.period-calendars {
  padding-right: 12px;
  border-right: 1px solid #e5e7eb;
}

.period-months-nav {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.period-nav-button {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  font-size: 12px;
}

.period-nav-year {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
}

.period-months-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.period-month-card {
  display: grid;
  gap: 8px;
}

.period-month-title {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}

.period-weekdays,
.period-days-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
}

.period-weekdays span {
  text-align: center;
  font-size: 12px;
  color: #4b5563;
}

.period-day {
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  font-size: 12px;
}

.period-day-outside {
  color: #9ca3af;
}

.period-day-in-range {
  background: #e0e7ff;
  border-color: #c7d2fe;
}

.period-day-start,
.period-day-end {
  background: #c7d2fe;
  border-color: #818cf8;
  font-weight: 600;
}

.period-sidebar {
  padding-left: 12px;
}

.period-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.period-preset-button,
.period-secondary-button,
.period-primary-button {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.period-preset-button,
.period-secondary-button {
  border: 1px solid #d1d5db;
  background: #ffffff;
}

.period-fields {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.period-field {
  display: grid;
  gap: 6px;
}

.period-field label {
  font-size: 12px;
  color: #4b5563;
}

.period-field input {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 12px;
}

.period-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.period-primary-button {
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #111827;
}

@media (max-width: 960px) {
  .period-calendar-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .period-calendars {
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 16px;
  }

  .period-sidebar {
    padding-left: 0;
  }
}

@media (max-width: 720px) {
  .period-trigger {
    min-width: 100%;
  }

  .period-months-grid {
    grid-template-columns: 1fr;
  }
}
</style>
