export interface SyncJobMessage {
  userId: string;
  itemId: string;
  cursor?: string;
  retryCount?: number;
}

export interface SyncResult {
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  nextCursor: string;
  hasMore: boolean;
}

export interface TransactionRecord {
  id: string;
  accountId: string;
  transactionId: string;
  amount: number;
  date: string;
  authorizedDate?: string;
  name: string;
  merchantName?: string;
  category?: string;
  pending: boolean;
  transactionType?: string;
  paymentChannel?: string;
}
