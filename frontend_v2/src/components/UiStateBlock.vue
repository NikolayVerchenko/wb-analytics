<template>
  <div class="state-block" :data-variant="variant">
    <div class="state-block-content">
      <h4 class="state-block-title">{{ title }}</h4>
      <p class="state-block-text">{{ description }}</p>
    </div>
    <button
      v-if="actionLabel"
      type="button"
      class="state-block-action"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    variant?: 'info' | 'error' | 'empty'
    actionLabel?: string
  }>(),
  {
    variant: 'info',
    actionLabel: '',
  },
)

defineEmits<{
  action: []
}>()
</script>

<style scoped>
.state-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
}

.state-block[data-variant='info'] {
  background: #f8fafc;
}

.state-block[data-variant='empty'] {
  background: #f9fafb;
}

.state-block[data-variant='error'] {
  background: #fef2f2;
  border-color: #fecaca;
}

.state-block-title {
  margin: 0 0 4px;
  font-size: 15px;
  color: #111827;
}

.state-block-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.state-block-action {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
}
</style>
