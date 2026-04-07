<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex min-w-[228px] items-center justify-between gap-3 rounded-[16px] border border-sand/80 bg-white px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft transition hover:border-mint"
      :disabled="disabled"
      @click="isOpen = !isOpen"
    >
      <span>{{ triggerLabel }}</span>
      <svg class="h-4 w-4 text-clay" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3.25" y="4.5" width="13.5" height="12.25" rx="2.25" stroke="currentColor" stroke-width="1.5" />
        <path d="M6.25 2.75V6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M13.75 2.75V6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M3.75 8H16.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-[calc(100%+10px)] z-50 flex w-[540px] max-w-[calc(100vw-28px)] overflow-hidden rounded-[22px] border border-sand/80 bg-white shadow-[0_24px_70px_rgba(31,37,42,0.16)]"
    >
      <div class="min-w-0 flex-1 p-3.5">
        <VueDatePicker
          v-model="tempRange"
          class="wb-range-picker"
          inline
          auto-apply
          range
          :enable-time-picker="false"
          :month-change-on-scroll="false"
          :clearable="false"
          :week-start="1"
          format="dd.MM.yyyy"
        />
      </div>

      <div class="w-[198px] border-l border-sand/70 bg-paper/60 p-3.5">
        <div class="flex flex-col gap-2">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            class="rounded-[12px] border border-sand/80 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-mint hover:bg-mint-soft"
            @click="applyPreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="mt-4 flex flex-col gap-3">
          <label class="flex flex-col gap-1.5 text-sm text-ink/70">
            <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Начало периода</span>
            <input
              :value="draftDateFrom"
              type="date"
              class="rounded-[12px] border border-sand/80 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-mint"
              @input="draftDateFrom = ($event.target as HTMLInputElement).value"
            />
          </label>

          <label class="flex flex-col gap-1.5 text-sm text-ink/70">
            <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Конец периода</span>
            <input
              :value="draftDateTo"
              type="date"
              class="rounded-[12px] border border-sand/80 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-mint"
              @input="draftDateTo = ($event.target as HTMLInputElement).value"
            />
          </label>
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <button
            type="button"
            class="rounded-[12px] border border-sand/80 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-mint hover:bg-mint-soft"
            @click="resetDraft"
          >
            Сбросить
          </button>
          <button
            type="button"
            class="rounded-[12px] bg-clay px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clay/90"
            @click="saveRange"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

import { formatDateRu } from '../../lib/formatters'

type PresetKey = 'week' | 'two_weeks' | 'month' | 'quarter' | 'year'

const props = defineProps<{
  dateFrom: string
  dateTo: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  applyRange: [payload: { dateFrom: string; dateTo: string }]
}>()

const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const draftDateFrom = ref(props.dateFrom)
const draftDateTo = ref(props.dateTo)
const tempRange = ref<[Date, Date] | null>(toDateRange(props.dateFrom, props.dateTo))

const presets: Array<{ key: PresetKey; label: string }> = [
  { key: 'week', label: 'Неделя' },
  { key: 'two_weeks', label: '2 недели' },
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' },
  { key: 'year', label: 'Год' },
]

const triggerLabel = computed(() => `${formatDateRu(props.dateFrom)} - ${formatDateRu(props.dateTo)}`)

watch(
  () => [props.dateFrom, props.dateTo],
  ([nextFrom, nextTo]) => {
    draftDateFrom.value = nextFrom
    draftDateTo.value = nextTo
    tempRange.value = toDateRange(nextFrom, nextTo)
  },
)

watch(tempRange, (nextRange) => {
  if (!nextRange) return
  draftDateFrom.value = toIsoDate(nextRange[0])
  draftDateTo.value = toIsoDate(nextRange[1])
})

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
})

function onDocumentClick(event: MouseEvent) {
  if (!root.value) return
  if (root.value.contains(event.target as Node)) return
  isOpen.value = false
}

function applyPreset(key: PresetKey) {
  const end = parseIsoDate(props.dateTo)
  const start = new Date(end)

  if (key === 'week') start.setDate(end.getDate() - 6)
  if (key === 'two_weeks') start.setDate(end.getDate() - 13)
  if (key === 'month') start.setMonth(end.getMonth() - 1)
  if (key === 'quarter') start.setMonth(end.getMonth() - 3)
  if (key === 'year') start.setFullYear(end.getFullYear() - 1)

  tempRange.value = [start, end]
  draftDateFrom.value = toIsoDate(start)
  draftDateTo.value = toIsoDate(end)
}

function resetDraft() {
  draftDateFrom.value = props.dateFrom
  draftDateTo.value = props.dateTo
  tempRange.value = toDateRange(props.dateFrom, props.dateTo)
}

function saveRange() {
  emit('applyRange', {
    dateFrom: draftDateFrom.value,
    dateTo: draftDateTo.value,
  })
  isOpen.value = false
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateRange(dateFrom: string, dateTo: string): [Date, Date] {
  return [parseIsoDate(dateFrom), parseIsoDate(dateTo)]
}
</script>

<style scoped>
:deep(.wb-range-picker) {
  --dp-font-family: 'Segoe UI', Arial, sans-serif;
  --dp-border-radius: 14px;
  --dp-cell-border-radius: 10px;
  --dp-primary-color: #2f7ac9;
  --dp-primary-text-color: #ffffff;
  --dp-hover-color: #edf4ff;
  --dp-hover-text-color: #1b2430;
  --dp-range-between-dates-background-color: #e6eefb;
  --dp-range-between-dates-text-color: #1b2430;
  --dp-primary-disabled-color: #bfd5f3;
  --dp-month-year-row-height: 40px;
  --dp-menu-min-width: 100%;
}

:deep(.wb-range-picker .dp__theme_light) {
  border: 0;
  background: transparent;
}

:deep(.wb-range-picker .dp__main) {
  font-size: 14px;
}

:deep(.wb-range-picker .dp__calendar_wrap) {
  padding: 0;
}

:deep(.wb-range-picker .dp__instance_calendar) {
  width: 100%;
}

:deep(.wb-range-picker .dp__month_year_row) {
  margin-bottom: 8px;
}

:deep(.wb-range-picker .dp__month_year_wrap) {
  justify-content: center;
  font-weight: 600;
  color: #1b2430;
}

:deep(.wb-range-picker .dp__arrow_btn) {
  color: #7d8794;
}

:deep(.wb-range-picker .dp__calendar_header) {
  margin-bottom: 4px;
}

:deep(.wb-range-picker .dp__calendar_header_item) {
  height: 32px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(27, 36, 48, 0.72);
}

:deep(.wb-range-picker .dp__calendar_item) {
  width: 38px;
  height: 38px;
}

:deep(.wb-range-picker .dp__cell_inner) {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 14px;
}

:deep(.wb-range-picker .dp__today) {
  border-color: #d7efe5;
}

:deep(.wb-range-picker .dp__range_start),
:deep(.wb-range-picker .dp__range_end),
:deep(.wb-range-picker .dp__active_date) {
  background: #2f7ac9;
  color: #fff;
}

:deep(.wb-range-picker .dp__range_between) {
  background: #e6eefb;
  color: #1b2430;
}

:deep(.wb-range-picker .dp__action_row) {
  display: none;
}

:deep(.wb-range-picker .dp--tp-wrap) {
  display: none !important;
}
</style>
