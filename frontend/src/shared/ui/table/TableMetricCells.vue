<template>
  <td
    v-for="column in columns"
    :key="column.key"
    :class="resolvedCellClass"
  >
    {{ resolveValue(column) }}
  </td>
</template>

<script setup lang="ts">
import type { EconomicsMetricColumn } from '../../../entities/economics/model/columns'
import { formatDisplayValue } from '../../lib/formatters'

interface Props {
  columns: EconomicsMetricColumn[]
  row: object | null
  rowType: 'totals' | 'item' | 'size'
  cellClass?: string
  emptyValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  cellClass: 'px-4 py-4 text-ink',
  emptyValue: '—',
})

const resolvedCellClass = props.cellClass

function resolveValue(column: EconomicsMetricColumn): string {
  if (!props.row) {
    return props.emptyValue
  }

  const row = props.row as Record<string, unknown>

  if (props.rowType === 'totals') {
    return formatDisplayValue(column.kind, row[column.totalsKey] as string | number | null | undefined)
  }

  if (props.rowType === 'item') {
    return formatDisplayValue(column.kind, row[column.itemKey] as string | number | null | undefined)
  }

  if (!column.sizeKey) {
    return props.emptyValue
  }

  return formatDisplayValue(column.kind, row[column.sizeKey] as string | number | null | undefined)
}
</script>
