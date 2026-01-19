/**
 * Сервис для подготовки данных для графиков
 * Преобразует бизнес-данные в формат, пригодный для визуализации
 */

export interface ChartDataPoint {
  label: string
  value: number
  metadata?: Record<string, unknown>
}

export interface TimeSeriesDataPoint extends ChartDataPoint {
  date: string // ISO date (YYYY-MM-DD)
  timestamp: number
}

export interface MultiSeriesChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }>
}

export class ChartDataService {
  /**
   * Преобразует массив данных в формат для Chart.js
   */
  prepareBarChartData(
    data: ChartDataPoint[],
    series: Array<{ key: string; label: string; color: string }>
  ): MultiSeriesChartData {
    const labels = data.map(point => point.label)
    const datasets = series.map(serie => ({
      label: serie.label,
      data: data.map(point => {
        const metadata = point.metadata || {}
        return (metadata[serie.key] as number) || 0
      }),
      backgroundColor: serie.color,
      borderColor: serie.color,
      borderWidth: 1,
    }))

    return { labels, datasets }
  }

  /**
   * Преобразует временной ряд в формат для линейного графика
   */
  prepareLineChartData(
    data: TimeSeriesDataPoint[],
    series: Array<{ key: string; label: string; color: string }>
  ): MultiSeriesChartData {
    const labels = data.map(point => point.label)
    const datasets = series.map(serie => ({
      label: serie.label,
      data: data.map(point => {
        const metadata = point.metadata || {}
        return (metadata[serie.key] as number) || 0
      }),
      borderColor: serie.color,
      backgroundColor: `${serie.color}20`,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    }))

    return { labels, datasets }
  }

  /**
   * Группирует данные по периодам (дни, недели, месяцы)
   */
  groupByPeriod(
    data: TimeSeriesDataPoint[],
    period: 'day' | 'week' | 'month'
  ): ChartDataPoint[] {
    // TODO: Реализовать группировку по периодам
    return data.map(point => ({
      label: point.label,
      value: point.value,
      metadata: point.metadata,
    }))
  }
}
