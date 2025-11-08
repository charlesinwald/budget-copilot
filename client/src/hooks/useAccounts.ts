import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Account } from '../types';

async function fetchAccounts(accessToken: string | null): Promise<Account[]> {
  if (!accessToken) return [];
  const { data } = await api.post('/api/plaid/balance', { access_token: accessToken });
  // Normalize shape differences
  const accounts = (data.accounts || []) as any[];
  return accounts.map(a => ({
    id: a.id || a.accountId,
    accountId: a.accountId || a.id,
    name: a.name || a.officialName || 'Account',
    officialName: a.officialName || a.name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    balances: a.balances,
    currentBalance: a.currentBalance ?? a?.balances?.current ?? 0,
    availableBalance: a.availableBalance ?? a?.balances?.available ?? 0,
    currencyCode: a.currencyCode ?? a?.balances?.isoCurrencyCode ?? 'USD',
    institutionName: a.institutionName,
    lastUpdated: new Date().toISOString()
  })) as Account[];
}

export function useAccounts(accessToken: string | null) {
  return useQuery({
    queryKey: ['accounts', !!accessToken],
    queryFn: () => fetchAccounts(accessToken),
    enabled: !!accessToken
  });
}


