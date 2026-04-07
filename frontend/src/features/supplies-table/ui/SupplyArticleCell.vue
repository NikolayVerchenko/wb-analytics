<template>
  <div class="flex min-w-[180px] items-center gap-2">
    <img
      v-if="item.photo_url"
      :src="item.photo_url"
      alt="product"
      class="h-10 w-10 rounded-lg border border-sand object-cover"
    />
    <div>
      <p class="font-medium text-ink">{{ item.vendor_code }}</p>
      <p class="text-[11px] text-ink/45">nm_id: {{ item.nm_id }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SupplyItem } from '../../../entities/supplies/model/types'

defineProps<{
  item: SupplyItem
}>()
</script>
