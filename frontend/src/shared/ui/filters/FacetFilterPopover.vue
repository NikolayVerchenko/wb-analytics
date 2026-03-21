<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { FilterSection, FilterSelection } from './types'

const props = withDefaults(
  defineProps<{
    modelValue: FilterSelection
    sections: FilterSection[]
    title?: string
    applyLabel?: string
    resetLabel?: string
  }>(),
  {
    title: 'Фильтры',
    applyLabel: 'Применить',
    resetLabel: 'Сбросить',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: FilterSelection]
  apply: [value: FilterSelection]
}>()

const isOpen = ref(false)
const activeSectionKey = ref(props.sections[0]?.key ?? '')
const search = ref('')
const draft = ref<FilterSelection>({})

const cloneSelection = (value: FilterSelection): FilterSelection =>
  Object.fromEntries(Object.entries(value).map(([key, selected]) => [key, [...selected]]))

watch(
  () => props.modelValue,
  (value) => {
    draft.value = cloneSelection(value)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.sections,
  (sections) => {
    if (!sections.find((section) => section.key === activeSectionKey.value)) {
      activeSectionKey.value = sections[0]?.key ?? ''
    }
  },
  { immediate: true },
)

const activeSection = computed(() => {
  return props.sections.find((section) => section.key === activeSectionKey.value) ?? props.sections[0] ?? null
})

const filteredOptions = computed(() => {
  const section = activeSection.value
  if (!section) {
    return []
  }

  const pattern = search.value.trim().toLowerCase()
  if (!pattern) {
    return section.options
  }

  return section.options.filter((option) => option.label.toLowerCase().includes(pattern))
})

const getSelectedCount = (sectionKey: string) => draft.value[sectionKey]?.length ?? 0

const isChecked = (sectionKey: string, optionValue: string) => draft.value[sectionKey]?.includes(optionValue) ?? false

const toggleOption = (sectionKey: string, optionValue: string) => {
  const current = new Set(draft.value[sectionKey] ?? [])
  if (current.has(optionValue)) {
    current.delete(optionValue)
  } else {
    current.add(optionValue)
  }

  draft.value = {
    ...draft.value,
    [sectionKey]: [...current],
  }
}

const resetDraft = () => {
  draft.value = Object.fromEntries(props.sections.map((section) => [section.key, []]))
  search.value = ''
}

const applyDraft = () => {
  const value = cloneSelection(draft.value)
  emit('update:modelValue', value)
  emit('apply', value)
  isOpen.value = false
}

const activateSection = (sectionKey: string) => {
  activeSectionKey.value = sectionKey
  search.value = ''
}

const closePopover = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest?.('[data-filter-root]')) {
    return
  }

  isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) {
    draft.value = cloneSelection(props.modelValue)
    document.addEventListener('click', closePopover)
  } else {
    document.removeEventListener('click', closePopover)
  }
})
</script>

<template>
  <div class="relative" data-filter-root>
    <button
      type="button"
      class="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
      @click="isOpen = !isOpen"
    >
      <svg class="h-4 w-4 text-stone-700" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M3 5h14M6 10h8M8 15h4" stroke-linecap="round" />
      </svg>
      <span>{{ title }}</span>
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 top-[calc(100%+10px)] z-50 flex w-[640px] overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(28,23,23,0.12)]"
    >
      <div class="w-[210px] border-r border-stone-200 bg-stone-50/80 p-3">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          class="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition"
          :class="
            section.key === activeSectionKey
              ? 'bg-white font-medium text-stone-900 shadow-sm'
              : 'text-stone-600 hover:bg-white/80 hover:text-stone-900'
          "
          @click="activateSection(section.key)"
        >
          <span class="flex items-center gap-2">
            <span class="text-base leading-none text-stone-500" v-if="section.icon">{{ section.icon }}</span>
            <span>{{ section.label }}</span>
          </span>
          <span
            v-if="getSelectedCount(section.key)"
            class="inline-flex min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700"
          >
            {{ getSelectedCount(section.key) }}
          </span>
        </button>
      </div>

      <div class="flex min-h-[420px] flex-1 flex-col p-4">
        <div class="relative mb-4">
          <input
            v-model="search"
            type="text"
            :placeholder="activeSection ? `Поиск по ${activeSection.label.toLowerCase()}` : 'Поиск'"
            class="h-11 w-full rounded-2xl border border-stone-200 bg-white pl-4 pr-10 text-sm outline-none transition focus:border-stone-400"
          />
          <svg
            class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13 13l4 4" stroke-linecap="round" />
          </svg>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <div class="space-y-2">
            <label
              v-for="option in filteredOptions"
              :key="option.value"
              class="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
            >
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                :checked="!!activeSection && isChecked(activeSection.key, option.value)"
                @change="activeSection && toggleOption(activeSection.key, option.value)"
              />
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <span v-if="option.count !== undefined" class="text-xs text-stone-400">{{ option.count }}</span>
            </label>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-3 border-t border-stone-200 pt-4">
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-2xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700"
            @click="applyDraft"
          >
            {{ applyLabel }}
          </button>
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-2xl bg-stone-100 px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
            @click="resetDraft"
          >
            {{ resetLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
