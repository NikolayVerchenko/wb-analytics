<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-vue-next'

defineProps<{
  title: string
  value: string
  deltaPercent?: number | null
  trend?: 'up' | 'down' | 'neutral'
}>()
</script>

<template>
  <Card class="shadow-sm transition-all hover:shadow-md">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-sm font-medium text-zinc-500">
        {{ title }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-2xl font-bold text-zinc-900 tracking-tight">
        {{ value }}
      </div>
      <div v-if="deltaPercent !== undefined && deltaPercent !== null" 
           class="mt-1 flex items-center text-xs font-medium"
           :class="{
             'text-emerald-600': trend === 'up',
             'text-rose-600': trend === 'down',
             'text-zinc-500': trend === 'neutral'
           }">
        <ArrowUpRight v-if="trend === 'up'" class="mr-1 h-3.5 w-3.5" />
        <ArrowDownRight v-if="trend === 'down'" class="mr-1 h-3.5 w-3.5" />
        <Minus v-if="trend === 'neutral'" class="mr-1 h-3.5 w-3.5" />
        <span>{{ Math.abs(deltaPercent) }}% к прошлому периоду</span>
      </div>
    </CardContent>
  </Card>
</template>