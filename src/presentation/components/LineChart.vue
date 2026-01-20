<template>
  <div class="w-full h-full">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, LineElement, PointElement, LineController, Title, Tooltip, Legend)

type DatasetUnit = 'currency' | 'count'

interface LineDatasetInput {
  label: string
  data: number[]
  color: string
  dashed?: boolean
  unit?: DatasetUnit
}

interface Props {
  data: {
    labels: string[]
    datasets: LineDatasetInput[]
  }
}

const props = defineProps<Props>()
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCompact = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

const rgbaFromRgb = (color: string, alpha: number): string => {
  if (!color.startsWith('rgb(')) {
    return color
  }
  return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
}

const createChart = () => {
  if (!chartCanvas.value) return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: props.data.labels,
      datasets: props.data.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.color,
        backgroundColor: rgbaFromRgb(dataset.color, 0.12),
        borderWidth: 2,
        borderDash: dataset.dashed ? [6, 4] : undefined,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.35,
        fill: false,
        ...(dataset.unit ? { unit: dataset.unit } : {}),
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y
              const unit = (context.dataset as { unit?: DatasetUnit }).unit
              if (unit === 'currency') {
                return `${context.dataset.label}: ${formatCurrency(value)}`
              }
              return `${context.dataset.label}: ${formatCompact(value)}`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => {
              if (typeof value === 'number') {
                return formatCompact(value)
              }
              return value
            },
          },
        },
      },
    },
  }

  chartInstance = new Chart(chartCanvas.value, config)
}

onMounted(() => {
  createChart()
})

watch(
  () => props.data,
  () => {
    createChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>
