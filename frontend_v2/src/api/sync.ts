import { apiGet, apiPost } from './http'
import type {
  SyncCoverageResponse,
  SyncHistoryGapFillRequest,
  SyncHistoryGapFillResponse,
  SyncJobCreate,
  SyncJobCreateResponse,
  SyncJobDetailsResponse,
  SyncJobRunRequest,
} from '../types/sync'

export function getSyncCoverage(accountId: string): Promise<SyncCoverageResponse> {
  return apiGet<SyncCoverageResponse>(`/api/sync/coverage?account_id=${encodeURIComponent(accountId)}`)
}

export function createSyncJob(payload: SyncJobCreate): Promise<SyncJobCreateResponse> {
  return apiPost<SyncJobCreateResponse, SyncJobCreate>('/api/sync/jobs', payload)
}

export function fillMissingHistorySync(payload: SyncHistoryGapFillRequest): Promise<SyncHistoryGapFillResponse> {
  return apiPost<SyncHistoryGapFillResponse, SyncHistoryGapFillRequest>('/api/sync/history/fill-missing', payload)
}

export function continueSyncJob(payload: SyncJobCreate): Promise<SyncJobCreateResponse> {
  return apiPost<SyncJobCreateResponse, SyncJobCreate>('/api/sync/jobs/continue', payload)
}

export function getSyncJob(jobId: string): Promise<SyncJobDetailsResponse> {
  return apiGet<SyncJobDetailsResponse>(`/api/sync/jobs/${jobId}`)
}

export function resumeReadySyncJob(jobId: string): Promise<SyncJobDetailsResponse> {
  return apiPost<SyncJobDetailsResponse, Record<string, never>>(`/api/sync/jobs/${jobId}/resume-ready`, {})
}

export function runSyncJob(jobId: string, payload: SyncJobRunRequest): Promise<SyncJobDetailsResponse> {
  return apiPost<SyncJobDetailsResponse, SyncJobRunRequest>(`/api/sync/jobs/${jobId}/run`, payload)
}

export function retryFailedSyncJob(jobId: string): Promise<SyncJobDetailsResponse> {
  return apiPost<SyncJobDetailsResponse, Record<string, never>>(`/api/sync/jobs/${jobId}/retry-failed`, {})
}

export function cancelSyncJob(jobId: string): Promise<SyncJobDetailsResponse> {
  return apiPost<SyncJobDetailsResponse, Record<string, never>>(`/api/sync/jobs/${jobId}/cancel`, {})
}

export function restartSyncJob(jobId: string): Promise<SyncJobCreateResponse> {
  return apiPost<SyncJobCreateResponse, Record<string, never>>(`/api/sync/jobs/${jobId}/restart`, {})
}
