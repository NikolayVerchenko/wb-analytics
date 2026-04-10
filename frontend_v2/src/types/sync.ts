export type SyncJobType = 'initial_sales_backfill' | 'sales_funnel_backfill' | 'stock_snapshot_refresh' | 'open_week_refresh' | 'history_gap_fill'
export type SyncMode = 'daily' | 'weekly'
export type SyncDataset = 'sales' | 'cards' | 'adverts_snapshot' | 'adverts_cost' | 'acceptance' | 'storage' | 'sales_funnel' | 'warehouse_remains'
export type SyncJobStatus = 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'cancelled'
export type SyncJobStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled'
export type SyncCoverageSectionStatus = 'actual' | 'partial' | 'stale' | 'loading' | 'error' | 'empty'

export type SyncJobCreate = {
  account_id: string
  job_type: SyncJobType
  mode: SyncMode
  date_from: string
  date_to: string
  datasets: SyncDataset[]
}

export type SyncJobRunRequest = {
  max_steps: number
}

export type SyncJobCreateResponse = {
  job_id: string
  status: SyncJobStatus
}

export type SyncHistoryGapFillRequest = {
  account_id: string
  datasets: SyncDataset[]
}

export type SyncHistoryGapFillResponse = {
  job_id: string | null
  status: 'pending' | 'noop'
  message: string | null
  datasets: SyncDataset[]
  planned_steps: number
}

export type SyncJob = {
  job_id: string
  account_id: string
  job_type: SyncJobType
  mode: SyncMode
  date_from: string
  date_to: string
  status: SyncJobStatus
  datasets: SyncDataset[]
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export type SyncJobStep = {
  step_id: string
  job_id: string
  dataset: SyncDataset
  period_from: string
  period_to: string
  status: SyncJobStepStatus
  attempt: number
  error_message: string | null
  payload_json: Record<string, unknown> | null
  next_retry_at: string | null
  started_at: string | null
  finished_at: string | null
}

export type SyncJobDetailsResponse = {
  job: SyncJob
  steps: SyncJobStep[]
}

export type SyncDateRange = {
  date_from: string
  date_to: string
}

export type SyncCoverageDataset = {
  dataset: string
  label: string
  loaded_from: string | null
  loaded_to: string | null
  actual_at: string | null
  last_success_at: string | null
  entity_count: number | null
  has_gaps: boolean
  missing_periods: SyncDateRange[]
  status: SyncCoverageSectionStatus
  comment: string | null
}

export type SyncCoverageSection = {
  status: SyncCoverageSectionStatus
  datasets: SyncCoverageDataset[]
}

export type SyncCoverageActiveJob = {
  job_id: string
  job_type: SyncJobType
  mode: SyncMode
  status: SyncJobStatus
}

export type SyncCoverageResponse = {
  account_id: string
  historical: SyncCoverageSection
  operational: SyncCoverageSection
  reference_data: SyncCoverageSection
  active_jobs: SyncCoverageActiveJob[]
}
