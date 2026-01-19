import type { LoadedPeriodRepository } from './LoadedPeriodRepository'
import type { DatasetKey } from './types'
import type { SyncPolicy } from './SyncPolicy'
import { addDays, defaultHighWatermark } from './date'

export type MissingRange = {
  dataset: DatasetKey
  latestDate: string | null
  missingFrom: string | null
  missingTo: string | null
}

export class DataFreshnessService {
  constructor(
    private readonly loadedPeriodRepo: LoadedPeriodRepository,
    private readonly policy: SyncPolicy,
    private readonly nowIso: () => string
  ) {}

  async getMissingRanges(datasets: DatasetKey[]): Promise<MissingRange[]> {
    const high = defaultHighWatermark(this.nowIso())
    const results: MissingRange[] = []

    for (const dataset of datasets) {
      const periods = await this.loadedPeriodRepo.getByDataset(dataset)
      const latest = this.getLatestDate(periods)

      if (!latest) {
        const start = this.getDefaultStartDate(dataset, high)
        results.push({
          dataset,
          latestDate: null,
          missingFrom: start,
          missingTo: high,
        })
        continue
      }

      if (latest >= high) {
        results.push({
          dataset,
          latestDate: latest,
          missingFrom: null,
          missingTo: null,
        })
        continue
      }

      results.push({
        dataset,
        latestDate: latest,
        missingFrom: addDays(latest, 1),
        missingTo: high,
      })
    }

    return results
  }

  private getLatestDate(periods: { to: string }[]): string | null {
    if (!periods.length) return null
    return periods.reduce((max, p) => (p.to > max ? p.to : max), periods[0].to)
  }

  private getDefaultStartDate(dataset: DatasetKey, high: string): string {
    const policy = this.policy[dataset]
    if (policy.backfillLowerBound) {
      return policy.backfillLowerBound
    }
    if (policy.maxHistoryDays) {
      return addDays(high, -policy.maxHistoryDays + 1)
    }
    return high
  }
}
