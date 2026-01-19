<template>
  <div class="rounded-2xl border p-5 shadow-sm" :class="cardClass">
    <div class="flex items-center justify-between">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {{ title }}
        </p>
        <p class="mt-2 text-3xl font-semibold text-gray-900">
          {{ value }}
        </p>
      </div>
      <div class="flex h-11 w-11 items-center justify-center rounded-2xl border" :class="iconWrapClass">
        <component :is="iconComponent" class="h-5 w-5" :class="iconColorClass" />
      </div>
    </div>
    <div class="mt-4 h-1 w-full rounded-full bg-gradient-to-r" :class="accentClass"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, TrendingDown, Truck, Wallet } from 'lucide-vue-next'

interface Props {
  title: string
  value: string
  icon: 'TrendingUp' | 'TrendingDown' | 'Truck' | 'Wallet'
  color: 'blue' | 'red' | 'purple' | 'green'
}

const props = defineProps<Props>()

const iconComponent = computed(() => {
  const icons = {
    TrendingUp,
    TrendingDown,
    Truck,
    Wallet,
  }
  return icons[props.icon]
})

const cardClass = computed(() => {
  const classes = {
    blue: 'border-blue-100 bg-gradient-to-br from-blue-50 to-white',
    red: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white',
    purple: 'border-purple-100 bg-gradient-to-br from-purple-50 to-white',
    green: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',
  }
  return classes[props.color]
})

const iconWrapClass = computed(() => {
  const classes = {
    blue: 'border-blue-100 bg-blue-50',
    red: 'border-rose-100 bg-rose-50',
    purple: 'border-purple-100 bg-purple-50',
    green: 'border-emerald-100 bg-emerald-50',
  }
  return classes[props.color]
})

const iconColorClass = computed(() => {
  const classes = {
    blue: 'text-blue-600',
    red: 'text-rose-600',
    purple: 'text-purple-600',
    green: 'text-emerald-600',
  }
  return classes[props.color]
})

const accentClass = computed(() => {
  const classes = {
    blue: 'from-blue-500/40 to-blue-500/5',
    red: 'from-rose-500/40 to-rose-500/5',
    purple: 'from-purple-500/40 to-purple-500/5',
    green: 'from-emerald-500/40 to-emerald-500/5',
  }
  return classes[props.color]
})
</script>
