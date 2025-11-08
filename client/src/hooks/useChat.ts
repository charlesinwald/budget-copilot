import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Account, Transaction } from '../types';
import { buildChatContext } from '../utils/transactionHelpers';

interface ChatResponse {
  message?: string;
  content?: string;
  text?: string;
}

export function useChat() {
  return useMutation({
    mutationFn: async (params: { message: string; transactions: Transaction[]; accounts: Account[] }) => {
      const payload = buildChatContext(params.message, params.transactions, params.accounts);
      const { data } = await api.post('/api/ai/chat', payload);
      const content = (data?.message ?? data?.content ?? data?.text ?? '').toString();
      return content;
    }
  });
}


