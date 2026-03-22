<template>
  <div class="period-filter">
    <button type="button" class="period-trigger" @click="toggleOpen">
      <span>{{ periodLabel }}</span>
      <span class="period-trigger-icon">▦</span>
    </button>

    <div v-if="isOpen" class="period-popover">
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
import { computed, reactive, ref, watch } from 'vue'

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
  gap: 12px;
  min-width: 260px;
  padding: 10px 14px;
  border: 1px solid #7c3aed;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
}

.period-trigger-icon {
  color: #7c3aed;
  font-size: 18px;
}

.period-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 760px;
  max-width: calc(100vw - 64px);
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

.period-calendar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
}

.period-calendars {
  padding-right: 16px;
  border-right: 1px solid #e5e7eb;
}

.period-months-nav {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.period-nav-button {
  width: 40px;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
}

.period-nav-year {
  text-align: center;
  font-size: 28px;
  font-weight: 600;
}

.period-months-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.period-month-card {
  display: grid;
  gap: 10px;
}

.period-month-title {
  margin: 0;
  text-align: center;
  font-size: 24px;
  font-weight: 500;
}

.period-weekdays,
.period-days-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.period-weekdays span {
  text-align: center;
  font-size: 14px;
  color: #4b5563;
}

.period-day {
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
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
  padding-left: 16px;
}

.period-presets {
  display: grid;
  gap: 8px;
}

.period-preset-button,
.period-secondary-button,
.period-primary-button {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
}

.period-preset-button,
.period-secondary-button {
  border: 1px solid #d1d5db;
  background: #ffffff;
}

.period-fields {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.period-field {
  display: grid;
  gap: 6px;
}

.period-field label {
  font-size: 14px;
  color: #4b5563;
}

.period-field input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}

.period-actions {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.period-primary-button {
  border: 0;
  background: #f97316;
  color: #ffffff;
}

@media (max-width: 960px) {
  .period-popover {
    width: min(760px, calc(100vw - 32px));
  }

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

  .period-popover {
    left: auto;
    right: 0;
    width: calc(100vw - 32px);
  }

  .period-months-grid {
    grid-template-columns: 1fr;
  }
}
</style>
