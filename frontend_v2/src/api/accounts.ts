import { apiGet, apiPost } from './http'
import type { Account } from '../types/account'

export function getAccounts(): Promise<Account[]> {
  return apiGet<Account[]>('/api/accounts')
}

export type ConnectAccountPayload = {
  token: string
  name?: string | null
}

export type ConnectAccountResponse = {
  account: Account
  role: string
  created: boolean
}

export function connectAccount(payload: ConnectAccountPayload): Promise<ConnectAccountResponse> {
  return apiPost<ConnectAccountResponse, ConnectAccountPayload>('/api/accounts/connect', payload)
}
