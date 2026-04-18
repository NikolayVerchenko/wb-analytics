import { getAccounts } from '../api/accounts'

export async function getPostLoginRoute(): Promise<string> {
  const accounts = await getAccounts()
  return accounts.length > 0 ? '/settings' : '/connect-account'
}
