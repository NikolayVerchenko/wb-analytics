import { apiGet } from '../../../shared/api/http'
import type { Account } from '../model/types'

export function fetchAccounts(): Promise<Account[]> {
  return apiGet<Account[]>('/accounts')
}
