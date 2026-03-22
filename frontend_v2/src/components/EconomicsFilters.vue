<template>
  <div class="economics-filters">
    <button type="button" class="filters-trigger" @click="toggleOpen">
      <span class="filters-trigger-icon">☰</span>
      <span>Фильтры</span>
      <span v-if="appliedCount > 0" class="filters-badge">{{ appliedCount }}</span>
    </button>

    <div v-if="isOpen" class="filters-popover">
      <div class="filters-layout">
        <aside class="filters-sections">
          <button
            v-for="section in sections"
            :key="section.value"
            type="button"
            class="filters-section-button"
            :class="{ 'filters-section-button-active': activeSection === section.value }"
            @click="activeSection = section.value"
          >
            <span>{{ section.label }}</span>
            <span v-if="selectedCount(section.value) > 0" class="filters-section-count">
              {{ selectedCount(section.value) }}
            </span>
          </button>
        </aside>

        <section class="filters-options-panel">
          <div class="filters-search-row">
            <input
              v-model="search"
              type="text"
              class="filters-search-input"
              :placeholder="searchPlaceholder"
            />
          </div>

          <div v-if="loading" class="filters-message filters-message-info">Загрузка фильтров...</div>
          <div v-else-if="error" class="filters-message filters-message-error">{{ error }}</div>
          <div v-else class="filters-options-list">
            <label v-for="option in filteredOptions" :key="option.value" class="filters-option-item">
              <input
                type="checkbox"
                :checked="isSelected(option.value)"
                @change="toggleOption(option.value)"
              />
              <span class="filters-option-texts">
                <span class="filters-option-label">{{ option.label }}</span>
                <span v-if="option.hint" class="filters-option-hint">{{ option.hint }}</span>
              </span>
            </label>

            <div v-if="filteredOptions.length === 0" class="filters-message filters-message-empty">
              Ничего не найдено.
            </div>
          </div>
        </section>
      </div>

      <div class="filters-actions">
        <button type="button" class="filters-primary-button" @click="applyFilters">Применить</button>
        <button type="button" class="filters-secondary-button" @click="resetFilters">Сбросить</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getEconomicsFilterOptions } from '../api/filters'
import type {
  EconomicsFilterOptions,
  EconomicsFiltersValue,
  FilterOption,
  FilterSection,
} from '../types/filters'

const props = withDefaults(
  defineProps<{
    accountId: string
    dateFrom: string
    dateTo: string
    value?: EconomicsFiltersValue
  }>(),
  {
    value: () => ({
      subjects: [],
      brands: [],
      articles: [],
    }),
  },
)

const emit = defineEmits<{
  apply: [EconomicsFiltersValue]
  reset: []
}>()

const isOpen = ref(false)
const loading = ref(false)
const error = ref('')
const search = ref('')
const activeSection = ref<FilterSection>('article')
const options = ref<EconomicsFilterOptions>({
  subjects: [],
  brands: [],
  articles: [],
})

const draft = reactive<EconomicsFiltersValue>(cloneFilters(props.value))

const sections: Array<{ value: FilterSection; label: string }> = [
  { value: 'subject', label: 'Предмет' },
  { value: 'brand', label: 'Бренд' },
  { value: 'article', label: 'Артикул' },
]

const appliedCount = computed(() => props.value.subjects.length + props.value.brands.length + props.value.articles.length)

const currentOptions = computed<FilterOption[]>(() => {
  if (activeSection.value === 'subject') {
    return options.value.subjects
  }

  if (activeSection.value === 'brand') {
    return options.value.brands
  }

  return options.value.articles
})

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) {
    return currentOptions.value
  }

  return currentOptions.value.filter((option) => {
    const labelMatch = option.label.toLowerCase().includes(query)
    const hintMatch = option.hint?.toLowerCase().includes(query) ?? false
    const valueMatch = option.value.toLowerCase().includes(query)
    return labelMatch || hintMatch || valueMatch
  })
})

const searchPlaceholder = computed(() => {
  if (activeSection.value === 'article') {
    return 'Поиск по арт. продавца или WB'
  }

  if (activeSection.value === 'brand') {
    return 'Поиск по бренду'
  }

  return 'Поиск по предмету'
})

watch(
  () => props.value,
  (value) => {
    Object.assign(draft, cloneFilters(value))
  },
  { deep: true },
)

watch(activeSection, () => {
  search.value = ''
})

watch(
  () => [props.accountId, props.dateFrom, props.dateTo],
  () => {
    options.value = { subjects: [], brands: [], articles: [] }
    error.value = ''
    if (isOpen.value) {
      void loadOptions()
    }
  },
)

async function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    Object.assign(draft, cloneFilters(props.value))
    await loadOptions()
  }
}

async function loadOptions() {
  if (!props.accountId || !props.dateFrom || !props.dateTo) {
    options.value = { subjects: [], brands: [], articles: [] }
    return
  }

  loading.value = true
  error.value = ''

  try {
    options.value = await getEconomicsFilterOptions({
      account_id: props.accountId,
      date_from: props.dateFrom,
      date_to: props.dateTo,
    })
  } catch (err) {
    options.value = { subjects: [], brands: [], articles: [] }
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить фильтры.'
  } finally {
    loading.value = false
  }
}

function selectedCount(section: FilterSection): number {
  if (section === 'subject') {
    return draft.subjects.length
  }

  if (section === 'brand') {
    return draft.brands.length
  }

  return draft.articles.length
}

function getSelectedList(section: FilterSection): string[] {
  if (section === 'subject') {
    return draft.subjects
  }

  if (section === 'brand') {
    return draft.brands
  }

  return draft.articles
}

function isSelected(value: string): boolean {
  return getSelectedList(activeSection.value).includes(value)
}

function toggleOption(value: string) {
  const list = getSelectedList(activeSection.value)
  const index = list.indexOf(value)

  if (index >= 0) {
    list.splice(index, 1)
    return
  }

  list.push(value)
}

function applyFilters() {
  const payload = cloneFilters(draft)
  emit('apply', payload)
  isOpen.value = false
}

function resetFilters() {
  draft.subjects = []
  draft.brands = []
  draft.articles = []
  emit('reset')
}

function cloneFilters(value: EconomicsFiltersValue): EconomicsFiltersValue {
  return {
    subjects: [...value.subjects],
    brands: [...value.brands],
    articles: [...value.articles],
  }
}
</script>

<style scoped>
.economics-filters {
  position: relative;
}

.filters-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.filters-trigger-icon {
  font-size: 14px;
}

.filters-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
}

.filters-popover {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  z-index: 30;
  width: 520px;
  max-width: calc(100vw - 32px);
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14);
}

.filters-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  min-height: 360px;
}

.filters-sections {
  display: grid;
  align-content: start;
  padding: 12px;
  border-right: 1px solid #e5e7eb;
  background: #fafafa;
}

.filters-section-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 12px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  color: #374151;
}

.filters-section-button-active {
  background: #f3f4f6;
  color: #111827;
  font-weight: 600;
}

.filters-section-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.filters-options-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
  padding: 12px;
}

.filters-search-row {
  margin-bottom: 12px;
}

.filters-search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
}

.filters-options-list {
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 6px;
  max-height: 300px;
  padding-right: 4px;
}

.filters-option-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
}

.filters-option-item:hover {
  background: #f9fafb;
}

.filters-option-texts {
  display: grid;
  gap: 2px;
}

.filters-option-label {
  color: #111827;
}

.filters-option-hint {
  font-size: 12px;
  color: #6b7280;
}

.filters-message {
  padding: 12px;
  border-radius: 10px;
}

.filters-message-info {
  background: #eff6ff;
  color: #1d4ed8;
}

.filters-message-error {
  background: #fef2f2;
  color: #b91c1c;
}

.filters-message-empty {
  background: #f9fafb;
  color: #4b5563;
}

.filters-actions {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.filters-primary-button,
.filters-secondary-button {
  padding: 10px 16px;
  border-radius: 10px;
}

.filters-primary-button {
  border: 0;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: #ffffff;
}

.filters-secondary-button {
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  color: #374151;
}

@media (max-width: 720px) {
  .filters-popover {
    width: calc(100vw - 32px);
  }

  .filters-layout {
    grid-template-columns: 1fr;
  }

  .filters-sections {
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
  }
}
</style>
