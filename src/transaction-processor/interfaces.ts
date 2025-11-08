export interface TransactionMessage {
  transactionId: string;
  accountId: string;
  userId: string;
  retryCount?: number;
}

export interface EnrichedTransaction {
  aiCategory: string;
  aiConfidence: number;
  normalizedMerchantName?: string;
}

export interface SpendingPatternUpdate {
  userId: string;
  category: string;
  month: string;
  totalAmount: number;
  transactionCount: number;
  avgTransaction: number;
}
