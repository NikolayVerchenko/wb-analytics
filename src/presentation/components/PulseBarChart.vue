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
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend)

type DatasetUnit = 'currency' | 'count' | 'percent'

interface BarDatasetInput {
  label: string
  data: number[]
  color: string
  unit?: DatasetUnit
}

interface Props {
  data: {
    labels: string[]
    datasets: BarDatasetInput[]
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

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

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

  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: props.data.labels,
      datasets: props.data.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: rgbaFromRgb(dataset.color, 0.7),
        borderColor: dataset.color,
        borderWidth: 1,
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
              if (unit === 'percent') {
                return `${context.dataset.label}: ${formatPercent(value)}`
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
