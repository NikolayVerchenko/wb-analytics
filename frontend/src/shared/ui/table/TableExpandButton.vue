<template>
  <button
    type="button"
    class="inline-flex items-center justify-center rounded-full border border-sand bg-paper text-ink transition hover:border-clay hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
    :class="sizeClass"
    :disabled="disabled || isLoading"
  >
    <span v-if="isLoading">…</span>
    <span v-else>{{ expanded ? '⌄' : '›' }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  expanded: boolean
  isLoading?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  disabled: false,
  size: 'md',
})

const sizeClass = computed(() =>
  props.size === 'sm'
    ? 'h-8 w-8 text-base'
    : 'h-9 w-9 text-lg',
)
</script>
