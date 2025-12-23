<template>
  <div class="bg-white p-6 rounded-lg shadow">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600">{{ title }}</p>
        <p class="text-2xl font-bold mt-2" :class="colorClass">
          {{ value }}
        </p>
      </div>
      <div
        class="p-3 rounded-full"
        :class="iconBgClass"
      >
        <component :is="iconComponent" class="w-6 h-6" :class="iconColorClass" />
      </div>
    </div>
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

const colorClass = computed(() => {
  const classes = {
    blue: 'text-blue-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
  }
  return classes[props.color]
})

const iconBgClass = computed(() => {
  const classes = {
    blue: 'bg-blue-100',
    red: 'bg-red-100',
    purple: 'bg-purple-100',
    green: 'bg-green-100',
  }
  return classes[props.color]
})

const iconColorClass = computed(() => {
  const classes = {
    blue: 'text-blue-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
  }
  return classes[props.color]
})
</script>
