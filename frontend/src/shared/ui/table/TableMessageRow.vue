<template>
  <tr :class="rowClass">
    <td :class="cellClass"></td>
    <td :colspan="colspan" :class="resolvedMessageClass">{{ message }}</td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  colspan: number
  message: string
  variant?: 'neutral' | 'error'
  cellClass?: string
  messageClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  cellClass: 'px-4 py-4',
  messageClass: '',
})

const rowClass = computed(() =>
  props.variant === 'error'
    ? 'border-t border-sand/60 bg-red-50/70'
    : 'border-t border-sand/60 bg-[#f8f3ed]',
)

const resolvedMessageClass = computed(() => {
  if (props.messageClass) {
    return props.messageClass
  }
  return props.variant === 'error'
    ? 'px-4 py-4 text-sm text-red-700'
    : 'px-4 py-4 text-sm text-ink/70'
})
</script>
