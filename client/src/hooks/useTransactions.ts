import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Transaction } from '../types';
import { toISOUTCDateString } from '../utils/formatters';
import { generateMockTransactions } from '../utils/transactionHelpers';

interface FetchParams {
  accessToken: string | null;
  startDate?: string;
  endDate?: string;
  useMock?: boolean;
}

async function fetchTransactions(params: FetchParams): Promise<Transaction[]> {
  if (params.useMock) {
    return generateMockTransactions();
  }
  const { accessToken } = params;
  if (!accessToken) return [];
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = params.startDate || toISOUTCDateString(thirtyDaysAgo);
  const end = params.endDate || toISOUTCDateString(today);
  const { data } = await api.post('/api/plaid/transactions', {
    access_token: accessToken,
    start_date: start,
    end_date: end
  });
  const transactions = (data.transactions || []) as any[];
  return transactions.map(t => ({
    transaction_id: t.transaction_id || t.id,
    id: t.id || t.transaction_id,
    date: t.date,
    name: t.name,
    merchant_name: t.merchant_name,
    amount: typeof t.amount === 'number' ? t.amount : Number(t.amount),
    iso_currency_code: t.iso_currency_code || 'USD',
    category: t.category || [],
    category_id: t.category_id,
    pending: t.pending,
    account_id: t.account_id
  })) as Transaction[];
}

export function useTransactions(accessToken: string | null, startDate?: string, endDate?: string, useMock: boolean = false) {
  return useQuery({
    queryKey: ['transactions', accessToken, startDate, endDate, useMock],
    queryFn: () => fetchTransactions({ accessToken, startDate, endDate, useMock }),
    enabled: !!accessToken || useMock
  });
}


