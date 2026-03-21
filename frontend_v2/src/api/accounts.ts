import { apiGet } from './http'
import type { Account } from '../types/account'

export function getAccounts(): Promise<Account[]> {
  return apiGet<Account[]>('/api/accounts')
}
