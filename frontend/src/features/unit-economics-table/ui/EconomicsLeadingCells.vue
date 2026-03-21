<template>
  <template v-for="column in columns" :key="column.key">
    <td :class="articleClass">
      <template v-if="rowType === 'item'">
        <div class="flex min-w-[220px] items-center gap-3">
          <img
            v-if="itemRow?.photo_url"
            :src="itemRow.photo_url"
            alt="product"
            class="h-12 w-12 rounded-xl border border-sand object-cover"
          />
          <div>
            <p class="font-semibold text-ink">{{ itemRow?.vendor_code || '—' }}</p>
            <p class="text-xs text-ink/55">nm_id: {{ itemRow?.nm_id }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="rowType === 'size'">
        <div class="pl-3">
          <p class="font-medium text-ink">{{ sizeName }}</p>
          <p class="text-[11px] text-ink/45">детализация за период</p>
        </div>
      </template>

      <template v-else>
        <span :class="totalsArticleClass">{{ articleText }}</span>
      </template>
    </td>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { ECONOMICS_LEADING_COLUMNS } from '../../../entities/economics/model/columns'
import type { EconomicsPeriodItem, EconomicsPeriodSize, EconomicsPeriodTotals } from '../../../entities/economics/model/types'
interface Props {
  rowType: 'totals' | 'item' | 'size'
  totals?: EconomicsPeriodTotals | null
  item?: EconomicsPeriodItem | null
  size?: EconomicsPeriodSize | null
  articleClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  totals: null,
  item: null,
  size: null,
  articleClass: 'px-4 py-4',
})

const columns = ECONOMICS_LEADING_COLUMNS

const itemRow = computed(() => props.item)

const articleText = computed(() => {
  if (props.rowType === 'totals') return 'все артикулы'
  return '—'
})

const totalsArticleClass = computed(() =>
  props.rowType === 'totals' ? 'text-ink/45' : 'text-ink',
)

const sizeName = computed(() => {
  const value = props.size?.ts_name
  if (!value || !value.trim()) return 'Без размера'
  return value
})
</script>
